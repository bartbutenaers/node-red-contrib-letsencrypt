/**
 * Copyright 2020 Bart Butenaers
 *
 * Licensed under the Apache License, Version 2.0 (the "License");
 * you may not use this file except in compliance with the License.
 * You may obtain a copy of the License at
 *
 * http://www.apache.org/licenses/LICENSE-2.0
 *
 * Unless required by applicable law or agreed to in writing, software
 * distributed under the License is distributed on an "AS IS" BASIS,
 * WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
 * See the License for the specific language governing permissions and
 * limitations under the License.
 **/
// This node is based on the following tutorial (https://git.coolaj86.com/coolaj86/acme.js/src/branch/master/examples)
module.exports = function(RED) {
    var settings = RED.settings;
    const ACME = require('acme-v2');
    // Number of security libraries build by the rootCompany (@root)
    const Keypairs = require('@root/keypairs');
    const CSR = require('@root/csr');
    const punycode = require('punycode');
    const PEM = require('@root/pem');
    const pkg = require('./package.json');
    const fs = require('fs');
    const bcryptjs = require('bcryptjs');
    const passwordStrength = require('check-password-strength');
  
    function AcmeClientNode(config) {
        RED.nodes.createNode(this, config);
        this.authority       = config.authority; // Currently not used since we only support LetsEncrypt
        this.dnsProvider     = config.dnsProvider;
        this.maintainerEmail = config.maintainerEmail;
        this.subscriberEmail = config.subscriberEmail;
        this.certFilePath    = config.certFilePath;
        this.keyFilePath     = config.keyFilePath;
        this.privateKey      = config.privateKey;
        this.dnsToken        = config.dnsToken;
        this.dnsApiUser      = config.dnsApiUser;
        this.dnsUserName     = config.dnsUserName;
        this.dnsKey          = config.dnsKey;
        this.dnsSecret       = config.dnsSecret;
        this.dnsKeyId        = config.dnsKeyId;
        this.acmeInitialized = false;
        this.acmeBusy        = false;
        this.directoryUrl    = "";
        // Remark: private key and public key are stored in this.credentials
               
        var node = this;
       
        // Convert the typedinput content to a JSON array
        node.domains = RED.util.evaluateNodeProperty(config.domains, config.domainsType, node);
       
        if (!Array.isArray(node.domains)) {
            console.log("The Acme domains should be a JSON array of domain names");
            node.domains = null;
        }

        // The ACME spec requires clients to have RFC 7231 style User Agent, which can be contstructed based on the package name.
        var packageAgent = 'test-' + pkg.name + '/' + pkg.version;
       
        // Handle all the Acme.js logging
        function handleAcmeLogging(ev, msg) {
            var text = "Acme " + ev + " message = " + (msg.message || '') + " status = " + (msg.status || '');

            switch(ev) {
                case 'error':
                    node.error(text);
                    break;
                case 'warning':
                    node.warn(text);
                    break;
                default:
                    node.log(text);
            }
        }

        var acme = ACME.create({
            maintainerEmail: node.maintainerEmail,
            packageAgent: packageAgent,
            notify: handleAcmeLogging
        });

        // Let’s Encrypt offers two URLs:
        if (config.useTestUrl) {
            // Staging URL to test things before issuing trusted certificates, to reduce the chance of running up against rate limits.
            node.directoryUrl = 'https://acme-staging-v02.api.letsencrypt.org/directory';
        }
        else {
            // Production URL for real trusted certificates
            node.directoryUrl = 'https://acme-v02.api.letsencrypt.org/directory';
        }

        // Fetch the remote API and initialize the internal state according to the response.
        // The first time this is executed, the MAINTAINER will get a welcome email from the Acme.js team...
        // You don't need any account yet at this point ...
        acme.init(node.directoryUrl).then(function () {
            node.acmeInitialized = true;
        });

        this.createAcmeAccount = async function() {
            // Create an ACME Subscriber Account on the Let’s Encrypt cloud service.
            // In order to use Let’s Encrypt and ACME.js, you must agree to the respective Subscriber Agreement and Terms.
            // At this point, we assume that the user already has agreed to the terms and agreement on the config screen.
            var agreeToTerms = true;

            // Create an account with a signed JWS message, including your public account key.
            // ACME.js will sign all messages with the public account key.
            console.info("Registering new ACME account for Let’s Encrypt ...");
           
            // Generate locally an account keypair, from which will need only the private key.
            // Keypairs.js will use native node crypto or WebCrypto to generate the key.
            // And Keypairs.js will use a lightweight parser and packer to translate between formats.
            var accountKeypair = await Keypairs.generate({ kty: 'EC', format: 'jwk' });
            var accountKey = accountKeypair.private;

            var acmeAccount = await acme.accounts.create({
                email: this.subscriberEmail, // valid email (server checks MX records!)
                agreeToTerms: agreeToTerms,
                accountKey: accountKey
            });
            console.info('created account with id', acmeAccount.key.kid);
           
            // TODO controleren of deze newAccount.cert en newAccount.key bestaan !!!!!!!!!!!!!!!!!!!!!!!
            var acmeInformation = {
                accountKey : accountKey,
                account: acmeAccount
            }
           
            return acmeInformation;
        }

        async function getServerKey(node) {
            var serverKey;
            var serverPem;
           
            // The msg.payload will contain the path to the keystores
            // TODO or get the path from RED.settings
            // TODO moeten we https://github.com/node-red/node-red/wiki/Editor-Runtime-API#settingsgenerateuserkeyopts--promisestring gebruiken ?????????
            // TODO nieuwe keypair of bestaande gebruiken

            // Try to load an existing key pair from the specified key file.
            // This is the key used by the Node-RED webserver (typically named `privkey.pem`, `key.crt`, or `bundle.pem`).
            // TODO dit faalt als de file niet bestaat !!!!!!!!!!
            
            if (!fs.existsSync(node.keyFilePath)) {
                if (node.privateKey === "existing") {
                    throw "The specified key file does not exist";
                }
            }
            else {
                // Read the key pem file, unless we always need to create a new key
                if(node.privateKey !== "new") {
                    serverPem  = fs.readFileSync(node.keyFilePath, 'ascii');
                }
            }
            
            if (serverPem) {
                // Import the private key from the key pem file
                serverKey  = await Keypairs.import({ pem: serverPem });
            }
            
            if (!serverKey) {
                // Create a new key pair, unless we always need to use existing pem files
                if (node.privateKey !== "existing") {
                    var serverKeypair = await Keypairs.generate({ kty: 'RSA', format: 'jwk' });
                    serverKey = serverKeypair.private;
                    node.newServerKeyCreated = true;
                }
            }
           
            return serverKey;
        }
       
        async function createCSR(serverKey, encodedDomains) {
            var encoding = 'der';
            var typ = 'CERTIFICATE REQUEST';

            var csrDer = await CSR.csr({
                jwk: serverKey,
                domains : encodedDomains,
                encoding : encoding
            });
           
            // TODO checken of csrDer null is ...
            var csr = PEM.packBlock({
                type: typ,
                bytes: csrDer
            });
           
            return csr;
        }
       
        async function createSslCertificate(node, csr, encodedDomains) {
            var dns01Challenge;
            var acmeAccount = JSON.parse(node.credentials.acmeAccount);
            var acmeAccountKey = JSON.parse(node.credentials.acmeAccountKey);

            // In order to validate wildcard, localhost, and private domains through Let's Encrypt, you must use set some special TXT records in your domain's DNS.
            // This is called the ACME DNS-01 Challenge
            // For example:
            //
            // dig TXT example.com
            // ;; QUESTION SECTION:
            // ;_acme-challenge.example.com. IN TXT
            // ;; ANSWER SECTION:
            // _acme-challenge.example.com. 300 IN TXT "xxxxxxx"
            // _acme-challenge.example.com. 300 IN TXT "xxxxxxx"

            // Each plugin will define some options, such as an api key, or username and password that are specific to that plugin.
            switch (node.dnsProvider) {
                // https://www.npmjs.com/package/acme-dns-01-cloudflare
                case "cloudflare":
                    dns01Challenge = require('acme-dns-01-cloudflare').create({
                        token: node.dnsToken,
                    });
                    break;
                case "digitalocean":
                    // https://www.npmjs.com/package/acme-dns-01-digitalocean
                    dns01Challenge = require('acme-dns-01-digitalocean').create({
                        baseUrl: 'https://api.digitalocean.com/v2/domains',
                        token: node.dnsToken
                    });
                    break;
                case "duckdns":
                    // https://www.npmjs.com/package/acme-dns-01-duckdns
                    dns01Challenge = require('acme-dns-01-duckdns').create({
                        baseUrl: 'https://www.duckdns.org/update',
                        token: node.dnsToken
                    });
                    break;
                case "dnsimple":
                    // https://www.npmjs.com/package/acme-dns-01-dnsimple
                    dns01Challenge = require('acme-dns-01-dnsimple').create({
                        baseUrl: 'https://api.dnsimple.com/v2/',
                        account: node.dnsUserName,
                        token: node.dnsToken
                    });
                    break;
                case "godaddy":
                    // https://www.npmjs.com/package/acme-dns-01-godaddy
                    dns01Challenge = require('acme-dns-01-godaddy').create({
                        baseUrl: 'https://api.godaddy.com',
                        key: node.dnsKey,
                        secret: node.dnsSecret
                    });
                    break;
                case "gandi":
                    // https://www.npmjs.com/package/acme-dns-01-gandi
                    dns01Challenge = require('acme-dns-01-gandi').create({
                        baseUrl: 'https://dns.api.gandi.net/api/v5/',
                        token: node.dnsToken
                    });
                    break;
                case "namecheap":
                    // https://www.npmjs.com/package/acme-dns-01-namecheap
                    dns01Challenge = require('acme-dns-01-namecheap').create({
                        apiUser: node.dnsApiUser,
                        apiKey: node.dnsKey,
                        clientIp: '121.22.123.22', // TODO ?????????????????????????????????
                        username: node.dnsUserName,
                        baseUrl: 'https://api.namecheap.com/xml.response'
                    });
                    break;
                case "namedotcom":
                    // https://www.npmjs.com/package/acme-dns-01-namedotcom
                    dns01Challenge = require('acme-dns-01-namedotcom').create({
                        baseUrl: 'http://api.name.com/v4/',
                        username: node.dnsUserName,
                        token: node.dnsToken
                    });
                    break;
                case "route53":
                    // https://www.npmjs.com/package/acme-dns-01-route53
                    dns01Challenge = require('acme-dns-01-route53').create({
                        aws_access_key_id: node.dnsKeyId,
                        aws_secret_access_key: node.dnsKey
                        // debug: true // enable this for detailed logs
                        // ensureSync: true // AWS Route 53 does transactional changes which means it has a status of PENDING until in ensures that changes complete entirely on any individual DNS server, or not at all. You can force wait by setting this flag to true and it'll poll the changes until they're no longer pending.
                    });
                    break;
                case "vultr":
                    // https://www.npmjs.com/package/acme-dns-01-vultr
                    dns01Challenge = require('acme-dns-01-vultr').create({
                        baseUrl: 'https://api.vultr.com/v1/dns',
                        token: node.dnsToken
                    });
                    break;
                case "zeit":
                    // https://www.npmjs.com/package/acme-dns-01-zeit
                    dns01Challenge = require('acme-dns-01-zeit').create({
                        token: node.dnsToken
                    });
                    break;                   
            }
     
            var pems = await acme.certificates.create({
                account: acmeAccount,
                accountKey: acmeAccountKey,
                csr: csr,
                domains: encodedDomains,
                challenges: {
                    'dns-01': dns01Challenge
                }
            });
          
            return pems
        }
       
        function handleError(node, topic, err) {
            node.error("Error in " + topic + " : " + err);
            node.send([null, {payload: err, topic: topic}]);
            node.acmeBusy = false;
            node.status({fill:"red", shape:"dot", text:topic});
        }
       
        node.on("input", async function(msg) {
            var serverKey, csr, pems, webServer;
           
            if (this.acmeBusy) {
                console.log("The node is still busy with a previous certificate request.");
                return;
            }
           
            if (!node.domains) {
                console.log("A domain list should be specified, in order to send a CSR to Letsencrypt.");
                return;
            }
           
            if (!node.keyFilePath) {
                console.log("A key file should be specified, in order to send a CSR to Letsencrypt.");
                return;
            }
           
            if (!node.certFilePath) {
                console.log("A certificate file should be specified, in order to send a CSR to Letsencrypt.");
                return;
            }
           
            if (!node.acmeInitialized) {
                console.log("Wait until the ACME client has been initialized, before sending a CSR to Letsencrypt.");
                return;                
            }
            
            if (node.privateKey === "existing" && !fs.existsSync(node.certFilePath)) {
                console.log("The specified certificate file does not exist.");
                return;
            }
           
            // TODO this takes very long to display ...  Is that caused perhaps somehow by the 'await' statements??
            node.status({fill:"blue", shape:"ring", text:"requesting..."});
           
            this.acmeBusy = true;
            node.newServerKeyCreated = false;
           
            try {
                // Create (or load) the Node-RED server Keypair
                serverKey = await getServerKey(node);
            }
            catch (err) {
                handleError(node, "GET_SERVER_KEY", err);
                return;
            }

            // Make sure the array of domains is punycode-encoded
            var encodedDomains = node.domains.map(function(name) {
                return punycode.toASCII(name);
            });

            try {
                // Create a Certificate Sign Request (CSR)
                csr = await createCSR(serverKey, encodedDomains);
            }
            catch (err) {
                handleError(node, "CREATE_CSR", err);
                return;
            }

            try {
                // Acme.js will do a lots of things here:
                // - Do a dry run to ensure that the basic stuff is already ok.
                // - Send our CSR to LetsEncrypt.
                // - LetsEncrypt will return a key authorization file, which acme.js will store in our webroot directory.
                // - Notifiy LetsEncrypt that the file is available via 'some' webserver (our express js listener above for example).
                // - LetsEncrypt will call our webserver (during the http-01 challenge) to request the authorization file.  
                //   This way Letsencrypt is sure that we 'control' (as root) the domains that we have specified...
                // - Once LetsEncrypt has finished his checks, Acme.js will remove the key authorization file.
                pems = await createSslCertificate(node, csr, encodedDomains);
            }
            catch (err) {
                handleError(node, "CREATE_CERTIFICATE", err);
                return;
            }
           
            // When we arrive here, we have received a new certificate from LetsEncrypt...
            // We allways need to save the new certificate (and the entire certificate chain) into the specified key file.
            var fullchain = pems.cert + '\n' + pems.chain + '\n';
            fs.writeFileSync(node.certFilePath, fullchain, {encoding: 'ascii'});
            node.log("Acme client has stored the new certificate into " + node.certFilePath);
           
            if (node.newServerKeyCreated) {
                // Only when a NEW server key has been created, we will store it into the specified key file.
                // That way Node-RED has the entire keypair, i.e. the private key and the corresponding public key (= certificate).
                // Remark: we do this not in the getServerKey function, because the certificate renewal might fail.
                //         In that case Node-RED would not start anymore, because it would have a new private key and no corresponding new certificate...
                serverPem = await Keypairs.export({ jwk: serverKey });
                fs.writeFileSync(node.keyFilePath, serverPem, 'ascii');
            }
           
            node.status({fill:"green", shape:"dot", text:"cert loaded"});
           
            this.acmeBusy = false;
            node.send([{payload: "success"}, null]);
        });        
       
        node.on("close", function() {
            this.status({});
            this.acmeBusy = false;
            if (done) {
                done();
            }
        });
    }

    RED.nodes.registerType("acme-client", AcmeClientNode,{
        credentials: {
            acmeAccountKey: {type: "password"},
            acmeAccount:    {type: "password"}
        }
    });
   
    // Make the key pair generation available to the config screen (in the flow editor)
    RED.httpAdmin.get('/acme-client/:cmd/:id', RED.auth.needsPermission('acme-client.write'), async function(req, res){
        var acmeClientNode = RED.nodes.getNode(req.params.id);
       
        if (!acmeClientNode) {
            console.log("Cannot find Acme Client node with id = " + req.params.id);
            res.status(404).json({error: 'Unknown Acme Client node'});
            return;
        }
       
        switch (req.params.cmd) {
            case "create_acme_account":
                try {
                    var acmeInformation = await acmeClientNode.createAcmeAccount(res);
                   
                    // Return the acme informationto the config screen (since it needs to be stored in the node's credentials)
                    res.json(acmeInformation);
                }
                catch (err) {
                    console.log("Error while creating acme account: " + err);
                    // this will eventually be handled by your error handling middleware
                    res.status(500).json({error: 'Error creating acme account'});
                }
                break;
            case "create_password_hash":
                try {
                    // The password is passed as a query parameter
                    var password = req.query.password;
                    
                    // Create a password hash the same way as Node-RED does it.
                    var passwordHash = bcryptjs.hashSync(password, 8);
                    
                    // Calculate the password strength also
                    var strength = passwordStrength(password).value;
                    
                    res.json({hash: passwordHash, strength: strength});
                }
                catch (err) {
                    console.log("Error while creating password hash: " + err);
                    // this will eventually be handled by your error handling middleware
                    res.status(500).json({error: 'Error creating password hash'});
                }
                break;
            default:
                console.log("Unsupported acme command");
                res.status(404).json({error: 'Unknown command'});
                return;
        }
    });
}
