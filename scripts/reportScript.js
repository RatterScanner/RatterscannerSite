function addBoxEntry(boxContainerId, text) {
  const boxContainer = document.getElementById(boxContainerId);
  const newBoxEntry = document.createElement("div");
  newBoxEntry.className = "box";
  newBoxEntry.style.borderTop = "none";
  const paragraph = document.createElement("p");
  paragraph.style.margin = "10px";
  paragraph.textContent = text;
  newBoxEntry.appendChild(paragraph);
  boxContainer.appendChild(newBoxEntry);
}

function startInterval(){
  setInterval(function() {
    const url = "https://api.ratterscanner.com/status/" + scanID;
    fetch(url)
      .then(response => response.json())
      .then(data => {
        console.log(JSON.stringify(data))
        jsonData = data
        previousCompleted = completed
        completed = "completed"
        
        try {
          percentComplete = jsonData.progress.regex.percentageCompleted;
          if (!(percentComplete > 0)) {
            percentComplete = 1
          }
  
        } catch {
          percentComplete = 1;
        }
        
        try {
          if (completed == "active") {
            dynamicAnalysisStatus = jsonData.progress.networkAnalysis.status;
          } else if (completed == "waiting") {
            dynamicAnalysisStatus = "Waiting for analysis";
            position = jsonData.position;
          }
        } catch {
          console.error("Failed to get analysis status")
          alert("Failed to get analysis status")
          return;
        }
  
        if (!(previousCompleted == completed)) {
          location.reload();
        }
  
        if (completed == "waiting") {
          document.getElementById("quePositionElement").innerHTML = "Position in que: #" + position;
        } else if (!(completed == "completed")) {
          document.getElementById("staticAnalysisStatus").innerHTML = "Static analysis status: " + percentComplete;
          document.getElementById("dynamicAnalysisStatus").innerHTML = "Dynamic analysis status: " + dynamicAnalysisStatus;  
        }
  
      })
      .catch(error => console.error("Error:", error));
  }, 5000);
}

if (completed == "waiting") {
  document.getElementById("quePositionElement").innerHTML = "Position in que: #" + position;
  startInterval()
} else if (!(completed == "completed")) {
  document.getElementById("staticAnalysisStatus").innerHTML = "Static analysis status: " + percentComplete;
  document.getElementById("dynamicAnalysisStatus").innerHTML = "Dynamic analysis status: " + dynamicAnalysisStatus;
  startInterval()
} else {
  const scanReport = JSON.parse(document.getElementById('scanDataID').value);
  let maliciousFlagsCount = 0
  let suspiciousFlagsCount = 0
  let devFlagsCount = 0

  console.log(scanReport)
  scanReport.returnvalue.regex.flagsTriggered.forEach(function(flag) {
    if (flag.level == 5) {
      addBoxEntry("staticMaliciousTemplate", "Known malicious software identified as " + flag.description);
      maliciousFlagsCount += flag.level;
    } else if (flag.level >=3) {
      addBoxEntry("staticMaliciousTemplate", flag.description);
      maliciousFlagsCount += flag.level;
    } else if (flag.level >= 1) {
      addBoxEntry("staticSuspiciousTemplate", flag.description);
      suspiciousFlagsCount += flag.level;
    } else {
      addBoxEntry("devFlagTemplate", flag.description);
      devFlagsCount += 1
    }
  });

  if (maliciousFlagsCount == 0) {
    addBoxEntry("staticMaliciousTemplate", "No malicious flags were identified");
  }

  if (suspiciousFlagsCount == 0) {
    addBoxEntry("staticSuspiciousTemplate", "No suspicious flags were identified");
  }

  if (devFlagsCount == 0) {
    addBoxEntry("devFlagTemplate", "No dev flags were identified");
  }

  try{
    if (scanReport.returnvalue.networkAnalysis.generalResults.maliciousConnections.length === 0) {
      addBoxEntry("dynamicMaliciousTemplate", "No malicious connections were made");
    } else{ 
      scanReport.returnvalue.networkAnalysis.generalResults.maliciousConnections.forEach(function(flag) {
        addBoxEntry("dynamicMaliciousTemplate", flag);
        maliciousFlagsCount += 5;
      })      
    }    
  } catch {
    addBoxEntry("dynamicMaliciousTemplate", scanReport.returnvalue.networkAnalysis.errorData.messages[0]);    
  }

  try{
    if (scanReport.returnvalue.networkAnalysis.generalResults.unknownConnections.length === 0) {
      addBoxEntry("dynamicUnknownTemplate", "No malicious connections were made");
      suspiciousFlagsCount += 1;
    } else{ 
      scanReport.returnvalue.networkAnalysis.generalResults.unknownConnections.forEach(function(flag) {
        addBoxEntry("dynamicUnknownTemplate", flag);
      })      
    }    
  } catch {
    addBoxEntry("dynamicUnknownTemplate", scanReport.returnvalue.networkAnalysis.errorData.messages[0]);    
  }
  const divElement = document.getElementById("resultOverview")
  const spanElement = divElement.querySelector("span.malicious");

  if (downloadCount > 10000) {
    spanElement.className = "safe";
    spanElement.textContent = "Likley safe";

    const noticeSpan = document.getElementById("modrinthNotice")
    noticeSpan.className = "safe";
    noticeSpan.textContent = "This mod was found on modrinth with over 10k downloads, it's most likley safe";
  } else if (maliciousFlagsCount >= 4) {
    spanElement.className = "malicious";
    spanElement.textContent = "malicious";
  } else if (maliciousFlagsCount >=2) {
    spanElement.className = "malicious";
    spanElement.textContent = "Likley malicious";
  } else if (suspiciousFlagsCount >= 1) {
    spanElement.className = "suspicious";
    spanElement.textContent = "Suspicious";
  } else {
    spanElement.className = "safe";
    spanElement.textContent = "Safe";
  }
}



