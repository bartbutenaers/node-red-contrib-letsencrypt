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
    const Keypairs = require('@root/keypairs');
    const punycode = require('punycode');
    const CSR = require('@root/csr');
    const PEM = require('@root/pem');
    const pkg = require('../package.json');
    const acmeHttp01WebRoot = require('acme-http-01-webroot')
    const fs = require('fs');
    const express = require('express');
    const getPort = require('get-port');
    const path = require('path');
    
    function AcmeClientNode(config) {
        RED.nodes.createNode(this, config);
        this.http01challenge = config.http01challenge;
        this.dns01challenge  = config.dns01challenge;
        this.maintainerEmail = config.maintainerEmail;
        this.subscriberEmail = config.subscriberEmail;
        this.webroot         = config.webroot;
        this.certFilePath    = config.certFilePath;
        this.keyFilePath     = config.keyFilePath;
        this.createNewKey    = config.createNewKey;
        this.startWebServer  = config.startWebServer;
        this.portNumber      = config.portNumber;
        this.acmeInitialized = false;
        this.acmeBusy        = false;
        // Remark: private key and public key are stored in this.credentials
                
        var node = this;
        
        // Convert the typedinput content to a JSON array
        node.domains = RED.util.evaluateNodeProperty(config.domains, config.domainsType, node); 
        
        if (!Array.isArray(node.domains)) {
            console.log("The Acme domains should be a JSON array of domain names");
            node.domains = null;
        }

        if (!node.certFilePath || !fs.existsSync(node.certFilePath)) {
            node.certFilePath = null;
            console.log("The specified certificate file does not exist.");
        }
        
        if (!node.keyFilePath || !fs.existsSync(node.keyFilePath)) {
            node.keyFilePath = null;
            console.log("The specified key file does not exist.");
        }
        
        if (!node.webroot || node.webroot === "") {
            node.webroot = null;
            console.log("No webroot directory has been specified, so no token can be published on the web.");
        }
        
        // The ACME spec requires clients to have RFC 7231 style User Agent, which can be contstructed based on the package name.
        var packageAgent = 'test-' + pkg.name + '/' + pkg.version;
        
        // Handle all the Acme.js logging
        function handleAcmeLogging(ev, msg) {
            var text = "Acme " + ev + " message = " + (msg.message || '') + " status = " + (msg.status || '');
    debugger;
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
        // - Staging URL (for testing): https://acme-staging-v02.api.letsencrypt.org/directory
        // - Production URL: https://acme-v02.api.letsencrypt.org/directory
        // The staging URLs can be used to test things before issuing trusted certificates, to reduce the chance of running up against rate limits.
        var directoryUrl = 'https://acme-v02.api.letsencrypt.org/directory';

        // Fetch the remote API and initialize the internal state according to the response.
        // The first time this is executed, the MAINTAINER will get a welcome email from the Acme.js team...
        // You don't need any account yet at this point ...
        acme.init(directoryUrl).then(function () {
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
            
            // The msg.payload will contain the path to the keystores
            // TODO or get the path from RED.settings
            // TODO moeten we https://github.com/node-red/node-red/wiki/Editor-Runtime-API#settingsgenerateuserkeyopts--promisestring gebruiken ?????????
            // TODO nieuwe keypair of bestaande gebruiken

            // Try to load an existing key pair from the specified key file.
            // This is the key used by the Node-RED webserver (typically named `privkey.pem`, `key.crt`, or `bundle.pem`).
            // TODO dit faalt als de file niet bestaat !!!!!!!!!!
            
            // Read the existing key file only when requested
            if (!node.createNewKey) {
                var serverPem  = fs.readFileSync(node.keyFilePath, 'ascii');
                
                if (serverPem) {
                    serverKey  = await Keypairs.import({ pem: serverPem });
                }
            }
            
            if (!serverKey) {
                // When no server key pair is available, let's generate a new one ...
                var serverKeypair = await Keypairs.generate({ kty: 'RSA', format: 'jwk' });
                serverKey = serverKeypair.private;
                node.newServerKeyCreated = true;
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
        
        async function createSslCertificate(node, csr, encodedDomains, challenges) {
            var acmeAccount = JSON.parse(node.credentials.acmeAccount);
            var acmeAccountKey = JSON.parse(node.credentials.acmeAccountKey);
            
            var pems = await acme.certificates.create({
                account: acmeAccount,
                accountKey: acmeAccountKey,
                csr: csr,
                domains: encodedDomains,
                challenges: challenges
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
            
            if (!node.webroot) {
                console.log("A webroot directory should be specified, otherwise the http-01 challenge request from Letsencrypt will fail.");
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

            // Setup a chain of challenge modules: first http-01 and then dns-01.
            // Such a challenge is a strategy to validate a domain (see https://letsencrypt.org/docs/challenge-types/).
            // Use strategy dns-01 in following circumstances:
            // - for wildcards
            // - for local/private domains
            // - port number apart from 80 or 443
            var challenges = {};
            
            // Apply the http-01 challenge (first) when required
            if (node.http01challenge) {
                challenges['http-01'] = acmeHttp01WebRoot.create({
                    // Make sure that Acme.js will store the token file (which it receives from Letsencrypt),
                    // into the specified webroot directory.
                    webroot: node.webroot
                });
            }
            
            // Apply the dns-01 challenge (last) when required
            if (node.dns01challenge) {
                challenges['dns-01'] = {
                    init: async function(deps) {
                        // includes the http request object to use
                    },
                    zones: async function(args) {
                        // return a list of zones
                    },
                    set: async function(args) {
                        // set a TXT record with the lowest allowable TTL
                    },
                    get: async function(args) {
                        // check the TXT record exists
                    },
                    remove: async function(args) {
                        // remove the TXT record
                    },
                    // how long to wait after *all* TXTs are set
                    // before presenting them for validation
                    // (for most this is seconds, for some it may be minutes)
                    propagationDelay: 5000
                }
            }
            
            // Start a temporary webserver if required.
            // Indeed in the next step, the HTTP-01 challenge will request a file from http://<YOUR_DOMAIN>/.well-known/acme-challenge/<TOKEN>
            if (node.startWebServer) {
                if (!node.portNumber) {
                    handleError(node, "START_WEBSERVER", "Missing port number");
                    return;
                }
        
                node.portNumber = parseInt(node.portNumber);

                if (node.portNumber < 1024 || node.portNumber > 65535) {
                    handleError(node, "START_WEBSERVER", "Invalid port number: " + node.portNumber);
                    return;
                }
        
                var freePortNumber = await getPort({ port: node.portNumber });
                
                if (freePortNumber != node.portNumber) {
                    handleError(node, "START_WEBSERVER", "Port " + node.portNumber + " is already in use!");
                    return;
                }
        
                // Start a temporary ExpressJs webserver, to make the key authorization file available for Letsencrypt.
                var app = express();
                app.get("/.well-known/acme-challenge/:challenge", function(req, res) {
                    var requestedChallenge = req.params.challenge;
                    
                    node.log("Received LetsEncrypt http-01 challenge request " + requestedChallenge);
                 
                    var authorizationFilePath = path.join(node.webroot, requestedChallenge);
                    
                    // At this moment Acme.js should have stored temporarily the key authorization file in our webroot directory.
                    if (!fs.existsSync(authorizationFilePath)) {
                        res.status(404).send("No key authorization file for challenge " + requestedChallenge);
                        node.log("'No key authorization file for challenge " + requestedChallenge);
                    }
                    else {
                        res.status(200).sendFile(authorizationFilePath);
                        node.log("Key authorization file " + authorizationFilePath + " has been returned to Letsencrypt");
                    }
                });

                webServer = app.listen(this.portNumber, function() {
                    node.log("Acme client started listening on port " + node.portNumber);
                });
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
                pems = await createSslCertificate(node, csr, encodedDomains, challenges);
            }
            catch (err) {
                handleError(node, "CREATE_CERTIFICATE", err);
                return;
            }
            finally {
                // We can stop our temporary webserver (if started), since the temporary key authorization file has been removed anyway
                if (webServer) {
                    webServer.close();
                    node.log("Acme client stopped listening on port " + node.portNumber);
                }                    
            }
            
            // When we arrive here, we have received a new certificate from LetsEncrypt...
            // Save the new certificate (and the entire certificate chain) into the specified key file
            var fullchain = pems.cert + '\n' + pems.chain + '\n';
            fs.writeFileSync(node.certFilePath, fullchain, {encoding: 'ascii'});
            node.log("Acme client has stored the new certificate into " + node.certFilePath);
            
            if (node.newServerKeyCreated) {
                // When a new server key has been created, we will store it into the specified key file.
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
            default:
                console.log("Unsupported acme command");
                res.status(404).json({error: 'Unknown command'});
                return;
        }
    });
    
    // Make the free port checking available to the config screen (in the flow editor)
    RED.httpAdmin.post('/acme-client/check_free_port', RED.auth.needsPermission('acme-client.write'), async function(req, res){
        // Get the POST parameter(s)
        var portNumber = req.body.portnr;
        
        if (!portNumber) {
            console.log("Missing port number");
            res.status(200).json({error: "Missing port number"});
            return;
        }
        
        portNumber = parseInt(portNumber);

        if (portNumber < 1024 || portNumber > 65535) {
            console.log("Invalid port number: " + portNumber);
            res.status(200).json({error: 'Invalid port number'});
            return;
        }
        
        var freePortNumber = await getPort({ port: portNumber });
        
        // When the specified port number is not free, another (random) free port number will be returned
        var free = (freePortNumber === portNumber);
        
        res.json({ free: free });
    });
}