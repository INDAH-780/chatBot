// DOM elements
const chatHistory = document.getElementById("chat-history");
const userInput = document.getElementById("user-input");
const form = document.getElementById("chat-form");
const displayedImage = document.getElementById("files");
const uploadDescription = document.getElementById("upload-description");

// we hide the upload container and will be accessible only when the upload botton is clicked
const uploadContainer = document.querySelector(".uploads");
uploadContainer.style.display = "none";

let selectedFile = null;

// Handle file selection and image preview
displayedImage.addEventListener("change", (event) => {
  const file = event.target.files[0];
  selectedFile = file;
  if (file) {
    const reader = new FileReader();
    reader.onload = function (e) {
      const img = document.getElementById("imagePreview");
      img.src = e.target.result;
      img.style.display = "block";
      uploadContainer.style.display = "block";
       userInput.style.display = "none";
    };
    reader.readAsDataURL(file);
  }

  // Upload function
 
  const formData = new FormData();
  formData.append("image", file);
  formData.append("description", uploadDescription.value.trim());

//This is for uploading the file to the server
  fetch("http://localhost:3000/upload", {
    method: "POST",
    body: formData,
  })
    .then((response) => response.json()) 
    .then((data) => {
      console.log("File upload success:", data);

      // the path of the file is been returned from the server through the data.filePath
      const filePath = data.filePath; 

     
      return fetch("http://localhost:3000/gemini", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          path: filePath,
          mimeType: "image/jpeg", 
        }),
      });
    })
    .then((response) => response.text())
    .then((data) => {
      console.log("Gemini upload success:", data);
    })
    .catch((error) => {
      console.error("Error:", error);
    });
});


// Send message function
async function sendMessage() {
  const userMessage = userInput.value.trim();
  userInput.value = ""; 

  if (!userMessage && !selectedFile) {
    console.log("Please enter a message or select a file.");
    return;
  }

  console.log(selectedFile);
   try {
     const response = await fetch("http://localhost:3000/api/message", {
      
       method: "POST",
       headers: {
         "Content-Type": "application/json",
       },
       body: JSON.stringify({ message: userMessage, imagePath: selectedFile }),
     });

     if (!response.ok) {
       throw new Error(`HTTP error! status: ${response.status}`);
     }

     const data = await response.json();
     console.log("Response data:", data);


     chatHistory.innerHTML += `<div class="user-message">${userMessage}</div>`;
     if (selectedFile) {
       chatHistory.innerHTML += `<div class="user-message"><img src="${selectedFile}" alt="Uploaded Image" style="max-width: 200px; display: block;" /><div>${uploadDescription.value.trim()}</div></div>`;
     }
     chatHistory.innerHTML += `<div class="bot-message">${data.reply}</div>`;
   } catch (error) {
     console.error("Error:", error);
     chatHistory.innerHTML += `<div class="error-message">Error: ${error.message}</div>`;
    // Reset UI
    loader.style.display = "none";
    uploadContainer.style.display = "none";
    userInput.style.display = "block";
    document.getElementById("imagePreview").style.display = "none";
    selectedFile = null;
    displayedImage.value = ""; // Reset file input
    uploadDescription.value = ""; // Clear description field
  }

 
}


form.addEventListener("submit", (event) => {
  event.preventDefault(); 
  const loader = document.getElementById("loader");
  loader.style.display = "block"; 
  sendMessage().finally(() => {
    loader.style.display = "none";
  });
});

