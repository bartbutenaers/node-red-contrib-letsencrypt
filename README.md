# node-red-contrib-acme-client
A Node-RED node which acts like an ACME client, to connect to an Automated Certificate Management Environment (e.g. Letsencrypt)

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
+ To have a trusted certificate, create a CSR (certificate signing request) to have your certificate signed by a trusted CA (Certification Authority).  However such certificates are rather expensive.
+ It is also possible to get a trusted *free* certificate, by sending a request to an Automated Certificate Management Environment (e.g. Letsencrypt).  

To achieve the latter option, an acme client is required which can send the request via the ACME protocol (to prove that you are the real owner of the specified domain).  This node will act as an ACME client for your Node-RED flow.  Summarized:

![Summary](https://user-images.githubusercontent.com/14224149/79510872-79eb1a80-803e-11ea-9e47-7a46373a146b.png)

1. The Inject node triggers (e.g. every 3 months) the acme client node, which sends a *certificate request* (for your domain) to Letsencrypt.  P.S. the *domain* is the hostname being used in the url to access your Node-RED application (https://<domain>:1880).
2. Letsencrypt checks whether you are the real owner of the specified domain.
3. If everything is fine, Letsencrypt will return the requested certificate.
4. The acme client node will store the certificate in the specified cert file, and (optionally) the private key in the specified key file.  Normally this will be the Node-RED cert and key files, which are specified in the Node-RED settings.js file.

Remark: note that - apart from this node - there are other locations where acme clients could be used.  Some examples:

![Acme locations](https://user-images.githubusercontent.com/14224149/79510380-9175d380-803d-11ea-9d1c-d6153a45069c.png)

1. When accessing the router via a Dynamic DNS provider, some of those providers offer acme clients.
1. Some routers/firewalls offer acme clients (e.g. pfSense, ...).
1. Lots of webservers/reverse proxies provide acme clients (e.g. Nginx, ...).  Such a webserver can be installed on the same machine as Node-RED or a separate machine in front of the Node-RED machine.
1. In Node-RED itself by e.g. using this acme client node.

Note that some of these other solutions might be easier to setup (e.g. in case their port 80 is accessible from the internet), compared to option 4 ...

## Node usage

The following steps explain how to create a ***new subscriber account***:

1.	Specify both a subscriber and maintainer email address.
2.	Wait until the dialog is displayed, which informs you whether the account has been created successfully…
3.	Close the config screen and deploy your changes.
4.	Your new account is now ready to be used…

The above steps normally should only be executed ***once***! 

The following steps explain shortly how to generate a ***new certificate***:
1.	Specify the domains, which is an array of at least one public hostname.
2.	Specify the key file where the private key is stored.
3.	Specify the cert file where the public key (= certificate) is stored.
4.	Specify a web folder where (temporary) files can be exchanged with Letsencrypt.
5.	Make sure a webserver is available that can host the files in that web folder, which means make that folder accessible via http on port 80.  
6.	:warning: In case a temporary webserver has been used (with port number >= 1024), it is required to setup manually port redirection (from port 80 to the webserver port)!  E.g. using iptables on Linux …
7.	Inject a input message into this node, to trigger the certificate renewal.  

The above steps should be executed only once, about ***every 3 months***.

Indeed the Letsencrypt certificates are only valid for 90 days, so you should renew them in time (e.g. using a scheduler node).   Make sure you don’t trigger the certificate renewal process too often, because Letsencrypt has [rate limits]( https://letsencrypt.org/docs/rate-limits/).  For example you can only request 5 times a week duplicate certificates!
Further on this page you can find a process flow diagram, where all the steps are explained in more detail.

Example flow which will renew the Node-RED keypair on a Raspberry PI:

![Basic flow](https://user-images.githubusercontent.com/14224149/79503297-35a54d80-8031-11ea-8c6b-fa0cf68a6e2c.png)

```
[{"id":"bafa5027.404f6","type":"acme-client","z":"52532cb5.768c44","name":"","domains":"[\"homespy.duckdns.org\"]","domainsType":"json","http01challenge":true,"dns01challenge":false,"webroot":"/var/tmp/acme-challenge","certFilePath":"/home/pi/.node-red/cert.pem","keyFilePath":"/home/pi/.node-red/privkey.pem","createNewKey":true,"maintainerEmail":"bart.butenaers@telenet.be","subscriberEmail":"bart.butenaers@telenet.be","startWebServer":true,"portNumber":"1088","x":670,"y":700,"wires":[["9e67ce94.43ab1"],["85266ea4.5460f"]]},{"id":"37075bc7.548104","type":"inject","z":"52532cb5.768c44","name":"","topic":"","payload":"","payloadType":"date","repeat":"","crontab":"","once":false,"onceDelay":0.1,"x":480,"y":700,"wires":[["bafa5027.404f6"]]},{"id":"9e67ce94.43ab1","type":"debug","z":"52532cb5.768c44","name":"Success","active":true,"tosidebar":true,"console":false,"tostatus":false,"complete":"true","targetType":"full","x":880,"y":680,"wires":[]},{"id":"85266ea4.5460f","type":"debug","z":"52532cb5.768c44","name":"Failure","active":true,"tosidebar":true,"console":false,"tostatus":false,"complete":"true","targetType":"full","x":870,"y":720,"wires":[]}]
```

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

Make sure you specify the same hostnames as you use in your browsers address bar!  Because the browser will check whether that hostname matches with the hostname inside the certificate.  If those don’t match, an “invalid certificate” warning will appear …

### Use the HTTP-01 challenge for domain validation
The minimum required challenge, that allows LetsEncrypt to validate whether you control the domain.  Letsencrypt will access your domain (on port 80) and check whether you really control that domain (see token exchange in the process flow at the end of this page).

### Use the DNS-01 challenge for domain validation
This is only required in some circumstances, e.g. when wildcards are being used in the domain names.

:warning: ***CAUTION:*** I have not tested this feature yet…

### Web folder
Specify the directory where the (temporary) authorization key file will need to be stored, that we receive from Letsencrypt (e.g. /var/tmp/acme-challenge). Make sure that Letsencrypt can access this authorization key file (in the specified folder) via a webserver listening to port 80!

When an existing third-party webserver is already listening to port 80, you need to specify a directory that this webserver can access.

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

### Start webserver on port
To allow Letsencrypt to access the authorization key file, a webserver should listen to port 80 and host that file.  Two options exist:
+	You have already running an existing webserver, which is listening to port 80 (which is possible when this webserver has been started via administrator privileges).  In that case you don’t need to start a second temporary webserver!
+	:warning: However when no existing webserver is running, you can ask this node to start temporarily a minimal webserver to host the file.   But since Node-RED most probably isn't running as administrator (i.e. root), this temporary webserver is not allowed to listen to the (preserved) port 80. As a result: ***you need to redirect all traffic from port 80 to the specified port number (> 1024) yourself (e.g. via iptables on Linux).***

## Certificate renewal flow in detail

![Detail flow](https://user-images.githubusercontent.com/14224149/79505401-9bdf9f80-8034-11ea-8e24-9567254fb8ba.png)

0.	At startup Node-RED will read the key pair (both private key and public key), based on the file paths specified in the settings.js file:
   ```
   https: {
        key: fs.readFileSync('privkey.pem'),
        cert: fs.readFileSync('cert.pem')
   },
   ```
   
   Node-RED will start an ExpressJs webserver, which allows you to access the flow editor and the dashboard.  The keypair will be passed to that webserver to allow it to encrypt the data via SSL connections. 
1.	As soon as an input message arrives, the certificate request flow will be started.
2.	The private key will be read from the specified “key file” path.  A new key file (and a new private key) is generated, when the there is no file available.  Via the “Always create new key file (with new private key)” a new file (and a new private key) will always be generated, and the original key file will be overwritten!
Remark: in some circumstances you could specify another key file, which is not used by Node-RED core itself.
3.	Create a CSR (certificate signing request), which is required to request a new certificate.  In fact this is a request to have a public key officially signed, in this case by the Letsencrypt organisation.
4.	Optionally (when the “Start webserver on port xxx” checkbox is activated) a temporary webserver will be started, that listens for http requests at port xxx.   

   :warning: CAUTION: most of the time, Node-RED will not be running as root user (i.e. not started with sudo on Linux) to avoid Node-RED having too much permissions.  But as a result, Node-RED will have not enough permissions to start a webserver listening at port 80 (since port numbers 0 to 1023 are preserved).  So will need to specify a port number xxx between 1024 and 65535 in the config screen.

   This is not required when you have your own webserver running (as root user), which listening already to port 80.  In that case you can just specify a web folder that your web server can access:

   ![existing webserver](https://user-images.githubusercontent.com/14224149/79505569-da755a00-8034-11ea-869d-5e57c0e479e8.png)
 
5.	:warning: Optional step in case you have started a temporary webserver in the previous step.  Since we cannot start a webserver on port 80 (as non-root user), unfortunately you will manually have to setup port redirection:  all http requests that arrive on port 80 need to be redirected to port xxxx, which you have specified in the config screen.  On Linux for example, some commands need to be entered as root user (sudo …).
6.	Send the CSR to Acme.js
7.	Acme.js will send the CSR to Letsencrypt.  Remark: all communication is using the Acme protocol.
8.	Letsencrypt will generate a key authentication file for validation, and send it to Acme.js.  Remark: the filename is a random token.
9.	Acme.js will upload the file into the web folder, that has been specified in the config screen.  So now the webserver has access to the file.
10.	Acme.js will let Letsencrypt know that the file has been uploaded.
11.	Letsencrypt will validate the certificate request, by executing all challenges.  Minimally there will be a HTTP-01 challenge, which tries to read the key validation file from your webserver
12.	The HTTP-01 challenge will send following http request:
http://<YOUR_DOMAIN>/.well-known/acme-challenge/<TOKEN>
Remark: This explains why it is so important to listen to port 80.  Indeed Letsencrypt will send the request to port 80, because only root users can setup listeners for that preserved port.  This way Letsencrypt can be sure that they are talking to the person that is responsible for that domain.  Moreover there are some other limitations, like e.g. no redirections to ports other than 80 are allowed …  This way Letsencrypt knows for sure that they are talking to the administrator that controls the domain.  Nobody else can interfere in this secure mechanism, even if they run a containerized environment on the same machine…
13.	The webserver will return the key validation file, which is available (temporarily) in the web folder.  As soon as Letsencrypt receives his own file, they know that you are the owner of the domain.
14.	The temporary key authentication file will be removed from the web folder.  And when a temporary webserver has been started, it will be stopped now.
15.	The renewed certificate will be stored in the specified cert file.  And when a new private key has been created, it will be stored in the specified key file.  This way the entire keypair is updated.
