const express = require("express");
const https = require("node:https");
const multer = require("multer");
const FormData = require('form-data');
var svgCaptcha = require('svg-captcha');
const fs = require('fs');

const upload = multer();
const app = express();
const loadingGifs = [];
let clientIDS = {};

app.use(express.static("images"));
app.set("view engine", "ejs");
app.use(express.json());

function readKeyFile() {
    const file = 'key.txt';
    const contents = fs.readFileSync(file, 'utf-8');
    return contents;
  }

app.get("/", (req, res) => {
    res.render("index");
})

app.get("/favicon.ico", (req, res) => {
	res.download("https://ratterscanner.com/favicon.ico")
})

app.get("/report", (req, res) => {
    let appID = req.query.appID
    if (appID == undefined){
        res.status(404).render("404")
        return
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
        res.render("report", {completed: completed, gifName: "fadingWord.gif", appID: appID, jsonReport: jsonData});
    });
})

app.post("/upload", upload.single("jarFile"), (req, res) => {
  const { jarFile, captchaID, capAns } = req.body;
  const fileBuffer = req.file.buffer;
  const fileSize = req.file.size;
  const key = readKeyFile();

  if (captchaID in clientIDS && capAns == clientIDS[captchaID]){
    delete clientIDS[captchaID]
  } else {
    res.status(403).send("Captcha incorrect")
    console.log("Captcha incorrect")
    return;
  }

  if (!req.file) {
    return res.status(400).send({ message: "No file uploaded" });
  }

  if (key == null || key == ""){
      console.log("ERROR key not read")
      return res.status(500).send({ message: "Error key is null" });
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
      "api_key": key,
    }, formData.getHeaders())
  };
  let ID;

  const req2 = https.request(options, (res2) => {
    res2.on("data", (chunk) => { 
      console.log(`Received chunk: ${chunk}`);
      const jsonData = JSON.parse(chunk); // parse the response
      const ID = jsonData.id;
      res.status(200).send({ message: "Jar file uploaded successfully ID is:", appID: ID });
    });
    res2.on("end", () => {
      console.log("Upload complete");
    });
  });

  formData.pipe(req2);
});

app.get("/captchaTest", function (req, res) {
    res.render("captcha")
})

app.get('/captcha', function (req, res) {
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

  res.json({
    id: captchaID,
    svg: captcha.data.toString('utf8')
  });
});

app.use(function (req, res, next) {
	res.status(404).render("404")
});

app.listen(3000);
console.log('Listening at port 3000')