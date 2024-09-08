const tabs = document.querySelectorAll(".tab");
const tabContents = document.querySelectorAll(".box-content");
const URLSubmitButton = document.getElementById("urlSubmit");
const submitButton = document.getElementById("file-submit")
let submitted = false;
let file;

tabs.forEach((tab, index) => {
  tab.addEventListener("click", () => {
    tabs.forEach((t) => t.classList.remove("active"));
    tab.classList.add("active");
    tabContents.forEach((content) => content.style.display = "none");
    tabContents[index].style.display = "block";
  });
});
document.getElementById("file-input").addEventListener("change", (e) => {
  file = e.target.files[0];
  const fileSize = file.size;
  const fileName = file.name;
  
  if (fileSize / (1024 * 1024) > maxSize) {
    alert("File cannot be larger than: " + maxSize + " MB") // Make a fancy error notification or something
    return;
  }

  document.getElementById("fileInfo").innerHTML = `File: ${fileName} (${formatFileSize(fileSize)})`;
  document.querySelector(".popup-box").style.display = "flex";
});

document.querySelector(".close-popup").addEventListener("click", function() {
  URLSubmitButton.innerHTML = "Downloading";
  document.querySelector(".popup-box").style.display = "none";
});

async function submitFile() {
  if (submitted) {
    return; // The user has already pressed the submit button
  }
  submitButton.innerHTML = 'Validating';
  console.log("Submitted file")

  submitted = true;
  let authData = await getChallenge();
  submitButton.innerHTML = '<img src="upload.gif" alt="Submit">';
  sendFile(authData, file)
};

async function sendFile(auth, file) {
  const authHeader = `Altcha ${btoa(JSON.stringify(auth))}`;
  const response = grecaptcha.getResponse();
  const formData = new FormData();
  formData.append("jarFile", file);
  formData.append("g-recaptcha-response", response)

  const controller = new AbortController();
  const signal = controller.signal;

  // Set a timeout of 1 minute
  const timeoutId = setTimeout(() => {
    controller.abort();
    alert("Request timed out");
    window.location.reload();
    submitted = false; // Reset submitted here
  }, 60000);

  fetch("/upload", {
    method: "POST",
    headers: {
      "Authorization": authHeader,
    },
    body: formData,
    signal
  })
  .then(response => response.text()) // Get the response as text (HTML)
  .then(html => {
    clearTimeout(timeoutId);
    if (html.includes("rateLimited")) { // Check if the response is the rateLimited page
      document.body.innerHTML = html;
    } else {
      const data = JSON.parse(html);
      if (!(data.message.includes("Jar file uploaded successfully") || data.message.includes("File is safe"))) {
        alert(data.message);
      } else if (data.message.includes("File is safe")) {
        const sendData = {
          fileName: data.fileName,
          fileDownload: data.download
        };
        const queryString = `?data=${encodeURIComponent(JSON.stringify(sendData))}`;
        window.location.href = `/safe${queryString}`;
      } else if (data.message.includes("File is malicious")) {
        const sendData = {
          fileName: data.fileName,
        };
        const queryString = `?data=${encodeURIComponent(JSON.stringify(sendData))}`;
        window.location.href = `/malicious${queryString}`;
      } else {
        const appID = data.appID;
        window.location.href = "/report?appID=" + appID + "&downloads=" + data.downloads;
      }
    }
  })
  .catch(error => {
    if (error.name === "AbortError") {
      console.log("Request was aborted");
    } else {
      console.error(error);
    }
    submitted = false;
  })
  .finally(() => {
    submitted = false;
  });  
};

function formatFileSize(size) {
  const units = ["B", "KB", "MB", "GB", "TB"]; // Most likley wont need TB but may as well include it anyway
  let index = 0;
  while (size > 1024 && index < units.length - 1) {
    size /= 1024;
    index++;
  }
  return `${size.toFixed(2)} ${units[index]}`;
}

tabs.forEach((tab) => {
  tab.addEventListener("click", () => {
    tabs.forEach((t) => t.classList.remove("active"));
    tab.classList.add("active");
  });
});

async function submitURL(url) {
  if (url == "" || url == undefined) {
    alert("You must provide a URL");
    return;
  }
  
  URLSubmitButton.innerHTML = "Downloading";
  try {
    const response = await fetch(url);
    if (!response.ok) {
      console.error("Failed to download file" + response.status)
      alert("Error downloading from URL, if this persists download the file yourself")
      throw new Error(`Failed to download file from URL: `);
    }
    const blob = await response.blob();
    const urlObj = new URL(url);
    const fileName = urlObj.pathname.split('/').pop(); // extract file name from URL path
    if (!fileName) {
      fileName = "downloaded_file.jar"; // default file name if none is found
    }
    file = new File([blob], fileName, { type: "application/java-archive" });
    const fileSize = file.size;
    
    if (fileSize / (1024 * 1024) > maxSize) {
      alert("File cannot be larger than: " + maxSize + " MB") // Make a fancy error notification or something
      return;
    }
  
    document.getElementById("fileInfo").innerHTML = `File: ${fileName} (${formatFileSize(fileSize)})`;
    document.querySelector(".popup-box").style.display = "flex";
  } catch (error) {
    URLSubmitButton.innerHTML = "Submit";
    alert("Error downloading from URL, if this persists download the file yourself");
    console.error(error);
    return;
  }
}

async function getChallenge() {
  try {
    const response = await fetch("/upload", {
      method: "POST",
      headers: {
        "Content-Type": "application/json"
      },
    });

    const responseBody = await response.text();
    const data = JSON.parse(responseBody);

    if (data.message == "rate limited") {
      window.location.href = "/limited"; // Redirect to /limited endpoint
      return;
    } else {
      const challengeResponse = JSON.parse(responseBody);
      const challenge = challengeResponse.WWW_Authenticate.challenge;
      const salt = challenge.salt;
      const maxNumber = challenge.maxnumber;
      const algorithm = challenge.algorithm;
      const id = challengeResponse.ID;

      let solution;
      for (let i = 0; i < maxNumber; i++) {
        const concatenatedString = salt + i.toString();
        const hash = CryptoJS.SHA256(concatenatedString);
        const hashedString = hash.toString(CryptoJS.enc.Hex);

        if (hashedString === challenge.challenge) {
          solution = i;
          break;
        }
      }

      if (solution !== undefined) {
        const authData = {
          id: id,
          solution: solution,
          salt: salt,
          challenge: challenge.challenge,
        };
        return authData;
      } else {
        console.error("Error finding solution")
      }
    }
  } catch (error) {	
    console.error("Error: " + error.message);
  }
}