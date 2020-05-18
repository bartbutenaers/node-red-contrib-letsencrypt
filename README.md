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

## Security introduction

:warning: Every system connected to the internet might be hacked, so make sure your system is secured as good as possible!  The best way to do this is adding a reverse proxy between the internet and your Node-RED system.  Moreover it might be advisable to run your Node-RED system in a container (e.g. Docker) to limit the access to the host operating system.  But such setups are not in scope of this readme page!

This node helps users to secure their Node-RED communication, when a simple Node-RED setup is being used (without reverse proxies, containers, ...).

### Basic authentication

Basic authentication means that you should secure your Node-RED system at least with a ***username/password*** at login.  To do this you need to convert your password to a hash, and store your username and password in the Node-RED settings.js file.  Although this is not really related to Acme, this node will help you in accomplishing this:

1. Choose a safe password and enter it in the password field of this node's config screen.  

   ***CAUTION:*** The password and the hash won't be saved!  So the next time you open the screen, they will be gone (since you don't need them anymore in this node...). So make sure you remember it yourself!!!

2. Hit the 'arrow' button and then the password hash will be calculated, and also the password strength (which will show a different color depending on Weak, Medium or Strong):

   ![acme_password](https://user-images.githubusercontent.com/14224149/82138360-1ceeaa00-9820-11ea-8084-ce8b4b14207e.gif)

   P.S. You can get different hash values when you generate the hash for the same password multiple times.  That is normal ...

3. You need to copy manually this hash in your settings.js file:

   ![acme_password_settings](https://user-images.githubusercontent.com/14224149/82138406-7f47aa80-9820-11ea-9e7c-7a1637461406.png)

4. Restart Node-RED

5. When navigating to Node-RED you will get a login screen.  Pass your username (e.g. *"admin"*) and your password (e.g. *"my_password"*):

   ![acme_logon_screen](https://user-images.githubusercontent.com/14224149/82138407-7fe04100-9820-11ea-97bd-6f70e1d6d433.png)

6. Normally you should now be granted access to your Node-RED editor...

### Secure SSL connection

To make sure that the data is transferred in secret code between your browser (dashboard or flow editor) and the Node-RED server, a secure SSL connection needs to be setup.

A ***key pair*** should be generated on the server, which consists out of:
+ A ***private key*** which can decrypt data (i.e. make unreadable data readable again).  This key should NEVER be shared with others!
+ A ***public key*** which can encrypt data (i.e. make readable data unreadable).

As soon as a client connects, the public key whill be shared with the client (so the client can encrypt the data).  And the server can decrypt the data again:

![SSL connection](https://user-images.githubusercontent.com/14224149/80141935-aa850400-85aa-11ea-8c59-f4358357ee0e.png)

### SSL certificate

The above SSL connection will work fine, but the browser will warn that the connection is not private:

![Privacy warning](https://user-images.githubusercontent.com/14224149/80142949-54b15b80-85ac-11ea-8538-7812aa6944c3.png)

This warning indicates that the browser doesn't trust your public key, which has been send by the Node-RED server.  Indeed you have generated the key pair yourself, so there is no way the browser can tell whether your Node-RED server has sent that public key.  Perhaps a malicious hacker has intercepted your connection, and he sends his own public key to pretend like he is your Node-RED server.

At this point your public key is still ***self-signed***.  To make sure all browsers trust your public key, it should be signed by a trusted ***Certification Authority (CA)***.  Such a signed public key is called a ***certificate***.

There are two major certificate categories:
+ *paid SSL certificates*: those certificates have a validity of a couple of years.  Example CA's are Verisign, GlobalSign, ...
+ *free SSL certificates*: those certificates have a limited validity of a couple of months.  Example CA is LetsEncrypt.

### CSR

Having a public key signed by a CA goes like this:

![CSR](https://user-images.githubusercontent.com/14224149/80146891-defcbe00-85b2-11ea-8761-8dcf5c6a66c9.png)

1. Send a ***CSR (certificate signing request)*** to the CA, which contains our public key and some extra information.  The most important information is the ***CN (common name)*** which are the DNS domains to which this certificate will belong.
2. The CA will create a certificate, which means it adds some signing information  (e.g. valid until which date, issued by which CA ...) to your public key.
3. The certificate will be returned and has to be stored in the key-pair.  The key-pair now consists out of a private key and a ***signed*** public key (instead of a self-signed one).

### Certificate validation

When the browser has opened an SSL connection to your Node-RED server, you can see display the certificate:

![Certificate](https://user-images.githubusercontent.com/14224149/79503425-6c7b6380-8031-11ea-918b-bd028a653c9e.png)

And the ***certificate chain*** visualizes who has been signing your certificate:

![Certificate chain](https://user-images.githubusercontent.com/14224149/79503512-92a10380-8031-11ea-9b3e-52e6f981b444.png)

The browser will trust a certificate when following conditions are fullfilled:
+ The current date needs to be between the certificate from and to dates.
+ The issuer of the certificate needs to be a trusted CA (Certification Authority) like e.g. Letsencrypt.
+ The domain in the certificate must match the domain in the URL to your Node-RED application.
+ The certificate chain needs to be complete, and the root certificate should be issued by a trusted CA.

### ACME

The remaining of this page will focus on free SSL certificates.  To be able to have your public key signed for free, you need to have an ACME client that communicates via the ACME protocol with an ACME server.  ACME is the abbreviation of Automated Certificate Management Environment.  

This node will be the ACME client for Node-RED, which can send a CSR (certificate signing request) to the 

+ The easiest way is to create your own certificate, however such *self-signed* certificates are not trusted (e.g. by most browsers).
+ To have a trusted certificate, create a CSR (certificate signing request) to request a trusted CA (Certification Authority) company to sign your certificate.  However such certificates are rather expensive.
+ It is also possible to get a trusted *free* certificate, by sending a automated CSR request to an Automated Certificate Management Environment (e.g. Letsencrypt).  

To achieve the latter option, an acme client is required which can send the request via the ACME protocol (), to prove that you are the real owner of the specified domain.  This node will act as an ACME client for your Node-RED flow. 

### Alternatives

This node is not the only way to use LetsEncrypt certificates in a Node-RED environment.  Indeed there are other locations in your network where acme clients could be used.  Some examples:

![Acme locations](https://user-images.githubusercontent.com/14224149/79510380-9175d380-803d-11ea-9d1c-d6153a45069c.png)

1. When accessing the router via a DNS provider, some of those providers offer acme clients (e.g. Cloudflare).
1. Some routers/firewalls offer acme clients (e.g. pfSense, ...).
1. Lots of webservers/reverse proxies provide acme clients (e.g. Nginx, ...).  Such a webserver can be installed on the same machine as Node-RED or a separate machine in front of the Node-RED machine.
1. In Node-RED itself by e.g. using this acme client node.

## Node usage

### Process overview

The next diagram shows how this node is being used as an ACME client:

![Summary diagram](https://user-images.githubusercontent.com/14224149/80138962-fd0ff180-85a5-11ea-826a-786d8714613c.png)

1. The Inject node triggers (e.g. every 3 months) the acme client node, by injecting an input message with ```msg.payload="request_certificate"```, which will try to load the private key from the key (pem) file.  When no private key is found a new key pair is generated (i.e. both a private key and a corresponding public key).

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

### Use SSL in Node-RED

This node can be used to renew the certificate in any random location, to secure one or another connection.  However a common use case is to use the LetsEncrypt certificate to secure Node-RED itself.

To make sure Node-RED uses SSL connections, you will need to change the settings.js file:
+ Uncomment the ```var fs = require(‘fs’);``` line at the top of settings.js
+ Uncomment the following lines, to specify where the key and cert file will be located:
   ```
   https: {
        key: fs.readFileSync('privkey.pem'),
        cert: fs.readFileSync('cert.pem')
   },
   ```
   Those files will be saved in your Node-RED directory by default...
   
By using the same file paths in this node's config screen, the LetsEncrypt certificate will be loaded into the Node-RED cert file.

### Reload certificate

As soon as a renewed certificate has been stored in the Node-RED cert file, Node-RED should load the updated certificate and use it to secure new SSL connections.

Currently you will need to restart your Node-RED server, to make sure the renewed certificate is being loaded by Node-RED.  However I'm working on a [pull-request proposal](https://discourse.nodered.org/t/pull-request-proposal-automatic-certificate-renewal/21282) to have automatic certificate renewal in Node-RED.

### Public or private accessibility

This node can be used for different kind of Node-RED system setups, as long as Node-RED is able to connect to LetsEncrypt and the DNS provide.  Which means an outbound connection to the internet should be available:

![Setups](https://user-images.githubusercontent.com/14224149/80041524-f6796f80-84fc-11ea-9746-9a1ebbf46d58.png)

1. Public accessible online Node-RED system: as long as there is also an outbound connection to the internet, a LetsEncrypt certificate can be requested.  It doesn't matter whether you also allow inbound connections from the internet (e.g. to make your dashboard public available).  Of course you need to make sure your Node-RED is secured, but that is outside the scope of this page.
2. Private accessible online Node-RED system: as long as there is also an outbound connection to the internet, a LetsEncrypt certificate can be requested. 
2. Private accessible offline Node-RED system: when no outbound connection to the internet is available, ***NO*** LetsEncrypt certificate can be requested!

### Flow certificate renewal

The following example flow renews the LetsEncrypt certificate (on a Raspberry Pi), when a message with ```msg.payload="request_certificate"``` is injected manually:

![Renewal flow](https://user-images.githubusercontent.com/14224149/80087879-07a59900-855c-11ea-848b-42c3067a09c0.png)

```
[{"id":"92f9265b.fc36d8","type":"acme-client","z":"11289790.c89848","name":"Request LetsEncrypt certificate","authority":"letsencrypt","dnsProvider":"duckdns","dnsToken":"your_duckdns_token","dnsUserName":"","dnsEmail":"","dnsApiUser":"","dnsKeyId":"","dnsKey":"","dnsSecret":"","domains":"[\"your_subdomain.duckdns.org\"]","domainsType":"json","certFilePath":"/home/pi/.node-red/cert.pem","keyFilePath":"/home/pi/.node-red/privkey.pem","maintainerEmail":"your_email_address","subscriberEmail":"your_email_address","useTestUrl":false,"x":670,"y":480,"wires":[["d09e255e.fce988"],["96cdd55f.8533f8"]]},{"id":"d09e255e.fce988","type":"debug","z":"11289790.c89848","name":"LetsEncrypted updated","active":true,"tosidebar":true,"console":false,"tostatus":false,"complete":"true","targetType":"full","x":990,"y":480,"wires":[]},{"id":"96cdd55f.8533f8","type":"debug","z":"11289790.c89848","name":"LetsEncrypted updated","active":true,"tosidebar":true,"console":false,"tostatus":false,"complete":"true","targetType":"full","x":990,"y":540,"wires":[]},{"id":"4429cb4d.697a14","type":"inject","z":"11289790.c89848","name":"Renew certificate","topic":"","payload":"request_certificate","payloadType":"str","repeat":"","crontab":"","once":false,"onceDelay":0.1,"x":400,"y":480,"wires":[["92f9265b.fc36d8"]]}]
```

Of course it makes more sense to replace the Inject-node, by another node that sends a message once every few months (since a LetsEncrypt certificate expires after 3 months).  ***TODO*** example flow...

### Flow certificate information

The following flow demonstrates how to get information about the current certificate (stored in the specified cert file path), when a message with ```msg.payload="get_certificate_info"``` is injected manually:

![Information flow](https://user-images.githubusercontent.com/14224149/82138163-91284e00-981e-11ea-9dbe-a6aafd86b541.png)

```
[{"id":"70a6d890.f393b8","type":"inject","z":"11289790.c89848","name":"Get certificate info","topic":"","payload":"get_certificate_info","payloadType":"str","repeat":"","crontab":"","once":false,"onceDelay":0.1,"x":390,"y":480,"wires":[["92f9265b.fc36d8"]]},{"id":"92f9265b.fc36d8","type":"acme-client","z":"11289790.c89848","name":"Request LetsEncrypt certificate","authority":"letsencrypt","dnsProvider":"duckdns","dnsToken":"your_duckdns_token","dnsUserName":"","dnsEmail":"","dnsApiUser":"","dnsKeyId":"","dnsKey":"","dnsSecret":"","domains":"[\"your_subdomain.duckdns.org\"]","domainsType":"json","certFilePath":"/home/pi/.node-red/cert.pem","keyFilePath":"/home/pi/.node-red/privkey.pem","maintainerEmail":"your_email_address","subscriberEmail":"your_email_address","useTestUrl":false,"x":670,"y":480,"wires":[["d09e255e.fce988"],[]]},{"id":"d09e255e.fce988","type":"debug","z":"11289790.c89848","name":"Certificate info","active":true,"tosidebar":true,"console":false,"tostatus":false,"complete":"true","targetType":"full","x":960,"y":480,"wires":[]}]
```

The output message ```msg.payload``` contains information about the certificate:

![Certificate information](https://user-images.githubusercontent.com/14224149/82257913-292a5280-9959-11ea-91a9-d797b7c6de12.png)

The ```msg.expiresAt``` field contains the timestamp of the expiration date, which might be used for example to trigger an alarm when a certificate is going to expire in N days from now.  Or you can use it to trigger the certificate renewal!

The field ```msg.expiresInDays``` is a convience field that has been added by this node.  It contains the number of days until the certificate will expire.  When this value is negative, the certificate is already expired.  The following flow uses this field to renew the certificate two days before it expires, and triggers an alarm as soon as the certificate has expired:

![Expires in days flow](https://user-images.githubusercontent.com/14224149/82257641-ae613780-9958-11ea-95e1-8f0b468ed622.png)
```
[{"id":"70a6d890.f393b8","type":"inject","z":"11289790.c89848","name":"Get certificate info daily at 22:00","topic":"","payload":"get_certificate_info","payloadType":"str","repeat":"","crontab":"00 22 * * *","once":false,"onceDelay":0.1,"x":340,"y":480,"wires":[["92f9265b.fc36d8"]]},{"id":"92f9265b.fc36d8","type":"acme-client","z":"11289790.c89848","name":"Acme client","authority":"letsencrypt","dnsProvider":"duckdns","dnsToken":"your_duckdns_token","dnsUserName":"","dnsEmail":"","dnsApiUser":"","dnsKeyId":"","dnsKey":"","dnsSecret":"","domains":"[\"your_subdomain.duckdns.org\"]","domainsType":"json","certFilePath":"/home/pi/.node-red/cert.pem","keyFilePath":"/home/pi/.node-red/privkey.pem","privateKey":"existing","maintainerEmail":"your_email_address","subscriberEmail":"your_email_address","useTestUrl":false,"x":610,"y":480,"wires":[["d09e255e.fce988","f4ff75c9.781488"],["61a48ed.3a5637"]]},{"id":"d09e255e.fce988","type":"debug","z":"11289790.c89848","name":"Certificate info","active":true,"tosidebar":true,"console":false,"tostatus":false,"complete":"true","targetType":"full","x":820,"y":440,"wires":[]},{"id":"f4ff75c9.781488","type":"switch","z":"11289790.c89848","name":"Check expiresInDays","property":"payload.expiresInDays","propertyType":"msg","rules":[{"t":"lt","v":"0","vt":"num"},{"t":"eq","v":"2","vt":"num"}],"checkall":"true","repair":false,"outputs":2,"x":840,"y":480,"wires":[["d44416f6.d6b008"],["4f263587.3f983c"]],"outputLabels":["Expired!","Two days before"]},{"id":"d44416f6.d6b008","type":"debug","z":"11289790.c89848","name":"Alarm: Certificated is expired !!!","active":true,"tosidebar":true,"console":false,"tostatus":false,"complete":"true","targetType":"full","x":1110,"y":460,"wires":[]},{"id":"5241e044.c402e","type":"change","z":"11289790.c89848","name":"","rules":[{"t":"set","p":"payload","pt":"msg","to":"request_certificate","tot":"str"}],"action":"","property":"","from":"","to":"","reg":false,"x":400,"y":520,"wires":[["92f9265b.fc36d8"]]},{"id":"4bde2da9.5ad0f4","type":"link in","z":"11289790.c89848","name":"Renew certificate","links":["4f263587.3f983c"],"x":200,"y":520,"wires":[["5241e044.c402e"]],"l":true},{"id":"4f263587.3f983c","type":"link out","z":"11289790.c89848","name":"Two days before expiration","links":["4bde2da9.5ad0f4"],"x":1100,"y":520,"wires":[],"l":true},{"id":"61a48ed.3a5637","type":"debug","z":"11289790.c89848","name":"Problem detected","active":true,"tosidebar":true,"console":false,"tostatus":false,"complete":"true","targetType":"full","x":830,"y":520,"wires":[]}]
```

### Config screen in a nutshell

Make sure the properties of all 3 sections on the config screen have been supplied:

![config screen](https://user-images.githubusercontent.com/14224149/80087211-18a1da80-855b-11ea-97d6-9aa26a04b55a.png)

The following steps explain how to create a ***new subscriber account***, to subscribe (***once***) to the LetsEncrypt cloud service:

1.	Make sure the email address has been specified and this node is *deployed!
2.	Wait until the dialog is displayed, which informs you whether the account has been created successfully…
3.	Close the config screen and deploy your changes again.
4.	Your new account is now ready to be used…

The following steps explain shortly how to generate a ***new certificate*** ( about ***every 3 months***):

1.	Specify the domains, which is an array of at least one public hostname.
2.	Specify the key file where the private key is stored.
3.	Specify the cert file where the public key (= certificate) is stored.
4.	Inject a input message into this node, to trigger the certificate renewal.  

Indeed the Letsencrypt certificates are only valid for 90 days, so you should renew them in time (e.g. using a scheduler node).   Make sure you don’t trigger the certificate renewal process too often, because Letsencrypt has [rate limits]( https://letsencrypt.org/docs/rate-limits/).  For example you can only request 5 times a week duplicate certificates!
Further on this page you can find a process flow diagram, where all the steps are explained in more detail.

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

### Private key
This option determines how to deal with the private key (in the specified <key>.pem file):
+ *Use existing private key:* Always use the existing private key, and fail (with error) if the private key doesn't exist.
+ *Use or create private key:* Use the existing private key if available, or create a new private key if it doesn't exist yet.
+ *Always create private key:* Always create a new private key, even if an existing private key is available.! 
   
***CAUTION:*** in the latter case, the existing private key will be overwritten (in the specified key file)!
The public key (certificate) on the other hand will *always* be overwritten (in the specified cert file), to keep both pem files in sync (i.e. the keypair should always be complete).

### Maintainer
The maintainer email address is used by Root (i.e. Acme.js team) to notify you of security notices and bugfixes to ACME.js. This has to be a valid email address, since Root will check whether it exists!

The first time that you have deployed your node, the MAINTAINER will get a mail from the acme.js project team:

![Maintainer email](https://user-images.githubusercontent.com/14224149/79505786-30e29880-8035-11ea-899b-0102228a5e80.png)

### Provider
The name of the DNS provider that is being used, which ***owns*** the specified domains. When e.g. "DuckDns" is selected, then your specified domain array should look like this: 
```
["yourdomain.duckdns.org"]
```
The following DNS providers are currently supported by this node:
+ CloudFlare
+ Digital Ocean
+ DNSimple
+ DuckDNS
+ FreeDNS
+ GoDaddy
+ Gandi
+ LightSail
+ NameCheap
+ Name.com
+ Route53 (AWS)
+ Vultr

Depending on the selected DNS provider, the related authentication fields will be displayed...

### Authority
The name of the certification authority (CA) that will sign our certificates.  Currently only LetsEncrypt is supported.

### Subscriber
The subscriber email address is used by Let’s Encrypt to manage your account and notify you of renewal failures. This has to be a valid email address, since Letsencrypt will check whether it exists!

### Create Acme subscriber account
An Acme (i.e. LetsEncrypt) subscriber account will be created, based on the specified subscriber address.  The result will be stored in the "Account key" and "Account" fields. This new account will become active as soon as the flow is deployed.  Such an account is required to be able to request certificates from Letsencrypt.

Normally you should create a subscriber account only ***once***!

### Account Key
Your unique ECDSA (or RSA) subscriber account key in JWK format, that will be used to sign all your messages to Letsencrypt.

### Account
Your unique subscriber account information.
