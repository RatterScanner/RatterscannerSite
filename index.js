const express = require("express");
const https = require("node:https");
const multer = require("multer");
const FormData = require("form-data");
const fs = require("fs");

let config = undefined;

const data = fs.readFileSync("config.json", "utf8");
config = JSON.parse(data);

if (config == undefined) {
  console.error("Config is null and the program cannot continue")
  throw new Error(
    "Program Terminated");
}
const key = config.apiKey; 
if (key == null || key == "") { // Checks if the ratterscanner API key is invalid
  console.error("Key is null because of this the program cannot continue")
  throw new Error(
    "Program Terminated");
}


const upload = multer();
const app = express();
const fileSizeLimit = config.fileSizeLimit; // The maximum file size an uploaded file can have (In MB)
const hmacKey = config.altchaKey; // API key to act as an hmac key

app.use(express.static("images"));
app.set("view engine", "ejs");
app.use(express.json());

// --------------------------------------------------
// Put all functions here

const validateCaptcha = async (req) => {
  const humanKey = req.body["g-recaptcha-response"];
  console.log("Human key: " + humanKey)

  try {
    const response = await fetch(`https://www.google.com/recaptcha/api/siteverify`, {
      method: 'post',
      headers: {
        Accept: 'application/json',
        'Content-Type': 'application/x-www-form-urlencoded; charset=utf-8'
      },
      body: `secret=${config.captchaKey}&response=${humanKey}`
    });

    const json = await response.json();
    console.log(JSON.stringify(json))
    const isHuman = json.success;

    return isHuman;
  } catch (err) {
    console.error(`Error in Google Siteverify API: ${err.message}`);
    return false;
  }
};

app.use(function (req, res, next) {
	res.status(404).render("404")
});

// --------------------------------------------------
// Routes only beyond this point

app.get("/", (req, res) => {
    res.render("index", {siteKey: config.siteKey});
})

app.get("/favicon.ico", (req, res) => {
	res.download("https://ratterscanner.com/favicon.ico")
})

app.get("/report", (req, res) => {
    let appID = req.query.appID;
    let downloadCount = req.query.downloads;
    if (appID == undefined){
        res.status(404).render("404");
        return;
    }

    let url = "https://api.ratterscanner.com/status/" + appID;

    function getData(url, callback) {
        https.get(url, (res) => {
            let data = '';
            res.on('data', (chunk) => {
                data += chunk;
            });
            res.on('end', () => {
                let jsonData = JSON.parse(data);
                callback(jsonData);
            });
        }).on('error', (err) => {
            console.error(err);
            callback(null);
        }); 
    }

    getData(url, (jsonData) => {
        if (!jsonData) {
            res.status(500).render("error");
            return;
        }

        let completed = false;
        if (jsonData.state == "completed"){
            completed = true;
        }
        res.render("report", {completed: completed, downloads: downloadCount, gifName: "fadingWord.gif", appID: appID, jsonReport: jsonData});
    });
})

app.post("/upload", upload.single("jarFile"), async (req, res) => {
  const fileBuffer = req.file.buffer;
  const fileSize = req.file.size;
  
  console.log("Recieved file")

  // Validate captcha
  const captchaValid = await validateCaptcha(req);
  if (!captchaValid) {
    return res.status(400).send({ message: "Invalid captcha" });
  }

  if (!req.file) {
    return res.status(400).send({ message: "No file uploaded" });
  }
  const magicNumber = fileBuffer.toString('hex', 0, 4);

  if (magicNumber !== '504b0304') { // Check if a file is actually a jar file with magic bytes
    return res.status(400).send({ message: "Invalid JAR file" });
  }

  if (fileSize / (1024 * 1024) > fileSizeLimit) {
    return res.status(400).send({ message: "Files cannot be larger than " + fileSizeLimit + " MB" });
  }

  const formData = new FormData();
  formData.append("file", fileBuffer, {
    contentType: "application/octet-stream",
    filename: req.file.originalname
  });

  const options = {
    method: "POST",
    hostname: "api.ratterscanner.com",
    path: "/jar_scanner",
    headers: Object.assign({
      "Host": "api.ratterscanner.com",
      "api_key": key,
    }, formData.getHeaders())
  };
  let ID;

  const req2 = https.request(options, (res2) => {
    let data = "";
  
    res2.on("data", (chunk) => { 
      console.log("Recived chunk: " + chunk)
      data += chunk;
    });
  
    res2.on("end", () => {
      console.log("Upload complete");
      const jsonData = JSON.parse(data); // parse the response
      let fileSource
  
      if (jsonData.status == "File found in safe list, not scanning") { // The file has been manually marked as safe by a human
        if (Object.keys(jsonData.knownFileDetails.modrinthInfo).length > 0) {
          fileSource = jsonData.knownFileDetails.modrinthInfo.repoUrl;
        } else {
          fileSource = jsonData.knownFileDetails.githubInfo.repoUrl;
        }
        res.status(200).send({ message: "File is safe", fileName: jsonData.fileName, download: fileSource});
        return;
      }
      const downloads = jsonData.knownFileDetails?.modrinthInfo.amountOfDownloads;
      if (downloads == undefined) { // If the file has zero downloads or does not exist on modrinth 
        downloads = -1
      }
      const ID = jsonData.id;
      res.status(200).send({ message: "Jar file uploaded successfully ID is:", appID: ID, downloads: downloads});
    });
  });

  formData.pipe(req2);
});

app.get("/safe", function (req, res) {
  const data = JSON.parse(req.query.data);
  
  res.render("safe", {fileName: data.fileName, downloadLink: data.fileDownload});
});

app.listen(config.port);
console.log("Listening")