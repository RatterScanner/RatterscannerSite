const express = require("express");
const https = require("node:https");
const multer = require("multer");
const FormData = require('form-data');
var svgCaptcha = require('svg-captcha');
const fs = require('fs');

const upload = multer();
const app = express();
let clientIDS = {};
const captchaQueue = [];
const maxCaptchaIds = 100; // Limits the number of IDs that can be stored
const fileSizeLimit = 6 // The maximum file size an uploaded file can have (In MB)

app.use(express.static("images"));
app.set("view engine", "ejs");
app.use(express.json());

let config = undefined;

const data = fs.readFileSync('config.json', 'utf8');
config = JSON.parse(data);

app.get("/", (req, res) => {
    res.render("index");
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

app.post("/upload", upload.single("jarFile"), (req, res) => {
  const { jarFile, captchaID, capAns } = req.body;
  const fileBuffer = req.file.buffer;
  const fileSize = req.file.size;
  const key = config.apiKey;

  console.log("Recieved file")

  if (!req.file) {
    return res.status(400).send({ message: "No file uploaded" });
  }
  const magicNumber = fileBuffer.toString('hex', 0, 4);

  
  if (magicNumber !== '504b0304') { // Check if a file is actually a jar file with magic bytes
    return res.status(400).send({ message: "Invalid JAR file" });
  }

  if (key == null || key == "") {
      console.error("ERROR key not read")
      return res.status(500).send({ message: "Error key is null" });
  }

  if (fileSize / (1024 * 1024) > fileSizeLimit) {
    return res.status(400).send({ message: "Files cannot be larger than " + fileSizeLimit + " MB" });
  }

  if (captchaQueue.includes(captchaID) && capAns == clientIDS[captchaID]) {
    const index = captchaQueue.indexOf(captchaID);
    captchaQueue.splice(index, 1);
    delete clientIDS[captchaID]
  } else {
    res.status(403).send({message: "Captcha incorrect"})
    console.error("Captcha incorrect")
    return;
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
    let data = '';
  
    res2.on("data", (chunk) => { 
      console.log("Recived chunk: " + chunk)
      data += chunk;
    });
  
    res2.on("end", () => {
      console.log("Upload complete");
      const jsonData = JSON.parse(data); // parse the response
      let fileSource
  
      if (jsonData.status == "File found in safe list, not scanning") {
        if (Object.keys(jsonData.knownFileDetails.modrinthInfo).length > 0) {
          fileSource = jsonData.knownFileDetails.modrinthInfo.repoUrl;
        } else {
          fileSource = jsonData.knownFileDetails.githubInfo.repoUrl;
        }
        res.status(200).send({ message: "File is safe", fileName: jsonData.fileName, download: fileSource});
        return;
      }
      const downloads = jsonData.knownFileDetails?.modrinthInfo.amountOfDownloads;

      const ID = jsonData.id;
      res.status(200).send({ message: "Jar file uploaded successfully ID is:", appID: ID, downloads: downloads});
    });
  });

  formData.pipe(req2);
});

app.get("/captcha", function (req, res) {
  if (captchaQueue.length >= maxCaptchaIds) {
    // remove the oldest captcha ID if the limit is reached
    const oldestCaptchaId = captchaQueue.shift();
    delete clientIDS[oldestCaptchaId];
  }

  if (Math.round(Math.random()) == 1){
    const randomNumber = Math.floor(Math.random() * 3) + 4;
    var captcha = svgCaptcha.create({
      size: randomNumber,     
      color: "true"
    });
  } else {
    var captcha = svgCaptcha.createMathExpr({
      color: "true"
    });
  }

  var captchaID = Math.random().toString(36).substring(2, 9); // Generate a random ID
  var captchaText = captcha.text;
   
  clientIDS[captchaID] = captchaText;
  captchaQueue.push(captchaID);

  res.json({
    id: captchaID,
    svg: captcha.data.toString('utf8')
  });
});

app.get("/safe", function (req, res) {
  const data = JSON.parse(req.query.data);
  
  res.render("safe", {fileName: data.fileName, downloadLink: data.fileDownload});
});

app.use(function (req, res, next) {
	res.status(404).render("404")
});

app.listen(config.port);
console.log("Listening on port: " + config.port)