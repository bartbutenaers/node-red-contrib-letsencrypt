# node-red-contrib-acme-client
A Node-RED node which acts like an ACME client, to renew LetsEncrypt certificates.

:warning: ***This is an experimental version !!!!  This version is published on Github to be able to discuss it on the Discourse forum...*** 

## Install

Run the following npm command in your Node-RED user directory (typically ~/.node-red):
```
npm install bartbutenaers/node-red-contrib-acme-client
```

## Support my Node-RED developments

Please buy my wife a coffee to keep her happy, while I am busy developing Node-RED stuff for you ...

<a href="https://www.buymeacoffee.com/bartbutenaers" target="_blank"><img src="https://www.buymeacoffee.com/assets/img/custom_images/orange_img.png" alt="Buy my wife a coffee" style="height: 41px !important;width: 174px !important;box-shadow: 0px 3px 2px 0px rgba(190, 190, 190, 0.5) !important;-webkit-box-shadow: 0px 3px 2px 0px rgba(190, 190, 190, 0.5) !important;" ></a>

## Basic introduction

To be able to setup a secure SSL (https) connnection to your Node-RED system (flow editor and/or dashboard), an SSL certificate is required:
+ The easiest way is to create your own certificate, however such *self-signed* certificates are not trusted (e.g. by most browsers).
+ To have a trusted certificate, create a CSR (certificate signing request) to request a trusted CA (Certification Authority) company to sign your certificate.  However such certificates are rather expensive.
+ It is also possible to get a trusted *free* certificate, by sending a automated CSR request to an Automated Certificate Management Environment (e.g. Letsencrypt).  

To achieve the latter option, an acme client is required which can send the request via the ACME protocol (Automated Certificate Management Environment), to prove that you are the real owner of the specified domain.  This node will act as an ACME client for your Node-RED flow. 

TODO Normally this will be the Node-RED cert and key files, which are specified in the Node-RED settings.js file.
At startup Node-RED will read the key pair (both private key and public key), based on the file paths specified in the settings.js file:
```
   https: {
        key: fs.readFileSync('privkey.pem'),
        cert: fs.readFileSync('cert.pem')
   },
```
This is how the entire process flow looks like:

![Summary diagram](https://user-images.githubusercontent.com/14224149/80138962-fd0ff180-85a5-11ea-826a-786d8714613c.png)

1. The Inject node triggers (e.g. every 3 months) the acme client node, which will try to load the private key from the key (pem) file.  When no private key is found a new key pair is generated (i.e. both a private key and a corresponding public key).

2. The acme client node, which will try to load the public key from the cert file.

3. The acme client node sends a *certificate request* (for the specified domain) to Letsencrypt.  
   P.S. The CSR contains our public key and the information that has been specified (domains, ...).
   
4. LetsEncrypt sends a DNS verification token to the acme client node.

5. The acme client node will send the DNS verification token to the specified DNS provider, where it will be added to your domain for 5 minutes (as an informational TXT record).
   P.S. To make sure your DNS provider allows you to do that, you need to authenticate yourself at the DNS provider (by filling in the DNS related fields in the config screen).
   
6. Letsencrypt checks whether you are the real owner of the specified domain, by getting the DNS verification token from your DNS provider.  If LetsEncrypt can confirm that the token (available at your DNS provider) is identical to the token that they have send to you, then they know that you own the specified (sub)domain for that DNS provider.
   
7. If everything went well, Letsencrypt will return the requested signed certificate.

8. The acme client node will store the private key in the specified key file, only when a new private key has been generated (in step 1).  

9. The acme client node will store the renewed certificate in the specified cert file.   This way the entire keypair is updated in both files!

CAUTION: currently you will need to restart your Node-RED server, to make sure the renewed certificate is being loaded by Node-RED.  However I'm working on a [pull-request proposal](https://discourse.nodered.org/t/pull-request-proposal-automatic-certificate-renewal/21282) to have automatic certificate renewal in Node-RED.

This node can be used for different kind of Node-RED system setups, as long as Node-RED is able to connect to LetsEncrypt and the DNS provide.  Which means an outbound connection to the internet should be available:

![Setups](https://user-images.githubusercontent.com/14224149/80041524-f6796f80-84fc-11ea-9746-9a1ebbf46d58.png)

1. Public accessible online Node-RED system: as long as there is also an outbound connection to the internet, a LetsEncrypt certificate can be requested.  It doesn't matter whether you also allow inbound connections from the internet (e.g. to make your dashboard public available).  Of course you need to make sure your Node-RED is secured, but that is outside the scope of this page.
2. Private accessible online Node-RED system: as long as there is also an outbound connection to the internet, a LetsEncrypt certificate can be requested. 
2. Private accessible offline Node-RED system: when no outbound connection to the internet is available, ***NO*** LetsEncrypt certificate can be requested!

Note that - apart from this node - there are other locations where acme clients could be used.  Some examples:

![Acme locations](https://user-images.githubusercontent.com/14224149/79510380-9175d380-803d-11ea-9d1c-d6153a45069c.png)

1. When accessing the router via a Dynamic DNS provider, some of those providers offer acme clients.
1. Some routers/firewalls offer acme clients (e.g. pfSense, ...).
1. Lots of webservers/reverse proxies provide acme clients (e.g. Nginx, ...).  Such a webserver can be installed on the same machine as Node-RED or a separate machine in front of the Node-RED machine.
1. In Node-RED itself by e.g. using this acme client node.

CAUTION: when your Node-RED system is public accessible from the internet (e.g. a public accessible dashboard), then a webserver in front of your Node-RED system will be more secure!

## Node usage

The following basic flow renews the LetsEncrypt certificate (on a Raspberry Pi), when a message is injected manually:

![Basic flow](https://user-images.githubusercontent.com/14224149/80087879-07a59900-855c-11ea-848b-42c3067a09c0.png)

```
[{"id":"92f9265b.fc36d8","type":"acme-client","z":"11289790.c89848","name":"Request LetsEncrypt certificate","authority":"letsencrypt","dnsProvider":"duckdns","dnsToken":"999999999999999999999999999","dnsUserName":"","dnsEmail":"","dnsApiUser":"","dnsKeyId":"","dnsKey":"","dnsSecret":"","domains":"[\"mydomain.duckdns.org\"]","domainsType":"json","certFilePath":"/home/pi/.node-red/cert.pem","keyFilePath":"/home/pi/.node-red/privkey.pem","createNewKey":false,"maintainerEmail":"some.maintainer@someaddress.com","subscriberEmail":"some.subscriber@someaddress.com","useTestUrl":false,"x":670,"y":440,"wires":[["d09e255e.fce988"],["96cdd55f.8533f8"]]},{"id":"d09e255e.fce988","type":"debug","z":"11289790.c89848","name":"LetsEncrypted updated","active":true,"tosidebar":true,"console":false,"tostatus":false,"complete":"true","targetType":"full","x":990,"y":440,"wires":[]},{"id":"96cdd55f.8533f8","type":"debug","z":"11289790.c89848","name":"LetsEncrypted updated","active":true,"tosidebar":true,"console":false,"tostatus":false,"complete":"true","targetType":"full","x":990,"y":500,"wires":[]},{"id":"4429cb4d.697a14","type":"inject","z":"11289790.c89848","name":"Renew certificate","topic":"","payload":"","payloadType":"date","repeat":"","crontab":"","once":false,"onceDelay":0.1,"x":420,"y":440,"wires":[["92f9265b.fc36d8"]]}]
```

Of course it makes more sense to replace the Inject-node, by another node that sends a message once every few months (since a LetsEncrypt certificate expires after 3 months).  ***TODO*** example flow...

Make sure the properties of all 3 sections on the config screen have been supplied:

![config screen](https://user-images.githubusercontent.com/14224149/80087211-18a1da80-855b-11ea-97d6-9aa26a04b55a.png)

The following steps explain how to create a ***new subscriber account***:

1.	Make sure the email address has been specified.
2.	Wait until the dialog is displayed, which informs you whether the account has been created successfully…
3.	Close the config screen and deploy your changes.
4.	Your new account is now ready to be used…

The above steps normally should only be executed ***once***! 

The following steps explain shortly how to generate a ***new certificate***:
1.	Specify the domains, which is an array of at least one public hostname.
2.	Specify the key file where the private key is stored.
3.	Specify the cert file where the public key (= certificate) is stored.
4.	Inject a input message into this node, to trigger the certificate renewal.  

The above steps should be executed only once, about ***every 3 months***.

Indeed the Letsencrypt certificates are only valid for 90 days, so you should renew them in time (e.g. using a scheduler node).   Make sure you don’t trigger the certificate renewal process too often, because Letsencrypt has [rate limits]( https://letsencrypt.org/docs/rate-limits/).  For example you can only request 5 times a week duplicate certificates!
Further on this page you can find a process flow diagram, where all the steps are explained in more detail.

When the certificate renewal has been successful, you can see the new certificate arriving in your browser (e.g. when opening the Node-RED flow editor or dashboard):

![Certificate](https://user-images.githubusercontent.com/14224149/79503425-6c7b6380-8031-11ea-918b-bd028a653c9e.png)

And you will also see that the entire ***certificate chain*** has been loaded into the cert file:

![Certificate chain](https://user-images.githubusercontent.com/14224149/79503512-92a10380-8031-11ea-9b3e-52e6f981b444.png)

In case something has gone wrong, please check the Node-RED log for more (technical) details.  Errors will also be displayed in the node status field, or via the output messages (to allow you to trigger some post processing nodes)…

The browser will trust a certificate when following conditions are fullfilled:
+ The current date needs to be between the certificate from and to dates.
+ The issuer of the certificate needs to be a trusted CA (Certification Authority) like e.g. Letsencrypt.
+ The domain in the certificate must match the domain in the URL to your Node-RED application.
+ The certificate chain needs to be complete, and the root certificate should be issued by a trusted CA.

## Node configuration

A list of all node properties in the config screen.  To understand better where those properties will be used, please have a look at the detailed process flow at the end of this page!

### Domains
Provide an array of at least 1 domain name, i.e. the hostname(s) that need to be included into the certificate (optionally containing wildcards). 

There are some limitations:
+	The hostnames should be public accessible, which means Letsencrypt should be able to access them via the internet (on port 80)!
+	It is not possible to specify IP addresses instead of hostnames.

Make sure you specify the same hostnames as you use in your browsers address bar (```https://<domain>:1880```).!  Because the browser will check whether that hostname matches with the hostname inside the certificate.  If those don’t match, an “invalid certificate” warning will appear …

### Key file
The path to the key file where the private key is being stored. 
In most cases this will be the path to the Node-RED key file (e.g. /home/pi/.node-red/privkey.pem), since we will want to renew the key that is being used for both the Node-RED flow editor and the dashboard.

### Cert file
The path to the cert file where the public key (i.e. certificate) is being stored. 
In most cases this will be the path to the Node-RED cert file (e.g. /home/pi/.node-red/cert.pem), since we will want to renew the certificate that is being used for both the Node-RED flow editor and the dashboard.

### Always create new key file (with new private key)
This option determines what to do with the specified private key file:
+	If selected, a new key file will be created (at the specified file path) and the old one will be removed. Moreover a new private key will be created, and stored into the key file. 

    ***Caution:*** your existing privte key will get lost!!
   
+	If unselected, the node will try to get an existing private key from the specified key file). When available, that private key will be used. If nothing found, a new private key will be generated.

***CAUTION:*** both files should always be in sync!  To have a valid keypair, both the private key and its corresponding public key should be stored both.

### Maintainer
The maintainer email address is used by Root (i.e. Acme.js team) to notify you of security notices and bugfixes to ACME.js. This has to be a valid email address, since Root will check whether it exists!

The first time that you have deployed your node, the MAINTAINER will get a mail from the acme.js project team:

![Maintainer email](https://user-images.githubusercontent.com/14224149/79505786-30e29880-8035-11ea-899b-0102228a5e80.png)

### Subscriber
The subscriber email address is used by Let’s Encrypt to manage your account and notify you of renewal failures. This has to be a valid email address, since Letsencrypt will check whether it exists!

### Create Acme subscriber account
An Acme (i.e. LetsEncrypt) subscriber account will be created, based on the specified subscriber address.  The result will be stored in the "Account key" and "Account" fields. This new account will become active as soon as the flow is deployed.  Such an account is required to be able to request certificates from Letsencrypt.

Normally you should create a subscriber account only ***once***!

### Account Key
Your unique ECDSA (or RSA) subscriber account key in JWK format, that will be used to sign all your messages to Letsencrypt.

### Account
Your unique subscriber account information.
