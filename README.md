# RatterScanner Site

A website made for RatterScanner that let the users see more details about a scan, from a file or a scan ID.

You can test the website directly from [here](https://scan.ratterscanner.com/).

## Running

- Rename the config-example.json file to config.json and add your API key to "apiKey": "<apikeyGoHere>",
- Add the cloudflare turnstile site key and secret key to  "captchaKey": "<secretKeyGoHere>" and "siteKey": "<siteKeygoHere>"
- Make any other config changes 
- Run `npm install` to download libraries
- Run `npm run start` to start the webserver.

# Config
All configuration is done in the config.json file.

## Contributing
You are able to selfhost parts of the website. Some parts such as file uploading wont work on a selfhosted instance out of the box. We might make an easy testing process for this in the future.
Feel free to suggest new features or improvements via github issues! Please assign issues that require modifications to the backend to @eGirlQuint
