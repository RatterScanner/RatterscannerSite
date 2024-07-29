# RatterScanner Site

A website made for RatterScanner that let the users see more details about a scan, from a file or a scan ID.

You can test the website directly from [here](https://scan.ratterscanner.com/).

## Running

- Run `npm install`
- Create a `key.txt` file at the root and place your RatterScanner API key inside *(needed for the file upload)*
- Run `npm run start`.

# Config
There are only two variables that should be changed maxCaptchaIds and fileSizeLimit. maxCaptchaIds sets the limit for the number of captchas that can be stored at one time. When the limit is reached new captchas overwtite the old. fileSizeLimit sets the max allowed size for files to be uploaded. It is set at 6MB by deafult because the ratterscannerAPI takes more than 1min to respond with anything larger. </br>
If you wish to change the upload limit I would reccomend modifying the timeout time in the index.ejs file.