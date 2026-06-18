const style = document.createElement("link");

style.rel = "stylesheet";

style.href = chrome.runtime.getURL("style.css");

document.head.appendChild(style);



// KEYWORDS
const uploadKeywords = [

  "resume",
  "cv",
  "aadhaar",
  "aadhar",
  "pan",
  "passport",
  "photo",
  "profile",
  "image",
  "signature",
  "sign",
  "driving",
  "license",
  "licence",
  "certificate",
  "document",
  "10th",
  "x",
  "ssc",
  "secondary",
  "12th",
  "xii",
  "senior secondary",
  "marksheet",
  "payslip"

];



// IGNORE
const ignoredWords = [

  "upload",
  "file",
  "choose",
  "browse",
  "attach",
  "document"

];



// GET DOCUMENTS
async function getDocuments(){

  return new Promise(resolve=>{

    chrome.runtime.sendMessage(

      {
        type:"GET_DOCUMENTS"
      },

      response=>{

        resolve(response || []);

      }

    );

  });

}



// DETECT
function detectUploadFields(){

  const fileInputs =
    document.querySelectorAll(
      'input[type="file"]'
    );



  fileInputs.forEach(input=>{

    analyzeUploadContext(input);

  });

}



// ANALYZE
function analyzeUploadContext(input){

  if(input.dataset.quickdocsChecked)
    return;



  input.dataset.quickdocsChecked =
    "true";



  let nearbyText = "";



  if(input.labels?.length){

    nearbyText +=
      input.labels[0].innerText + " ";

  }



  if(input.parentElement){

    nearbyText +=
      input.parentElement.innerText + " ";

  }



  const previous =
    input.previousElementSibling;



  if(previous){

    nearbyText +=
      previous.innerText + " ";

  }



  nearbyText =
    nearbyText.toLowerCase();



  const matchedKeywords =
    uploadKeywords.filter(keyword=>{

      return (
        nearbyText.includes(keyword)
        &&
        !ignoredWords.includes(keyword)
      );

    });



  if(!matchedKeywords.length)
    return;



  createQuickDocsBox(
    input,
    matchedKeywords
  );

}



// CREATE BOX
async function createQuickDocsBox(
  input,
  matchedKeywords
){

  if(input.dataset.quickdocsAttached)
    return;



  input.dataset.quickdocsAttached =
    "true";



  const documents =
    await getDocuments();



  if(!documents.length)
    return;



  // SMART MATCHING
  let selectedDoc = null;

  let bestScore = -1;



  documents.forEach(doc=>{

    let score = 0;



    const name =
      (doc.name || "")
      .toLowerCase();



    const category =
      (doc.category || "")
      .toLowerCase();



    const tags =
      (doc.tags || [])
      .join(" ")
      .toLowerCase();



    matchedKeywords.forEach(keyword=>{

      if(tags.includes(keyword))
        score += 15;

      if(category.includes(keyword))
        score += 10;

      if(name.includes(keyword))
        score += 5;

    });



    if(score > bestScore){

      bestScore = score;

      selectedDoc = doc;

    }

  });



  if(!selectedDoc){

    selectedDoc =
      documents[0];

  }



  // WRAPPER
  const wrapper =
    document.createElement("div");



  wrapper.className =
    "quickdocs-wrapper hidden";



  wrapper.innerHTML = `

    <div class="quickdocs-box">

      <button class="qd-close">
        ✕
      </button>



      <div class="qd-title">
        Suggested
      </div>



      <div class="qd-file">

        📄

        <span class="qd-file-name">

          ${selectedDoc.name}

        </span>

      </div>



      <button class="qd-upload-btn">
        Upload
      </button>



      <div class="qd-another">
        Choose Another
      </div>



      <div class="qd-chooser hidden">

        <input
          type="text"
          class="qd-search"
          placeholder="Search..."
        />



        <div class="qd-doc-list">

          ${documents.map(doc=>`

            <div
              class="qd-doc-item"
              data-id="${doc.id}"
            >

              📄 ${doc.name}

            </div>

          `).join("")}

        </div>

      </div>

    </div>

  `;



  document.body.appendChild(
    wrapper
  );



  const box =
    wrapper.querySelector(
      ".quickdocs-box"
    );



  // POSITION
  function positionPopup(){

    let targetElement =
      input;



    const parent =
      input.parentElement;



    const clickable =
      parent?.querySelector(
        'button, label, span, div'
      );



    if(clickable){

      const clickableRect =
        clickable.getBoundingClientRect();



      if(
        clickableRect.width > 40
      ){

        targetElement =
          clickable;

      }

    }



    const rect =
      targetElement.getBoundingClientRect();



    wrapper.style.position =
      "absolute";



    wrapper.style.top =
      `${window.scrollY + rect.top - 2}px`;



    wrapper.style.left =
      `${window.scrollX + rect.right + 8}px`;

  }



  positionPopup();



  window.addEventListener(
    "scroll",
    positionPopup
  );



  window.addEventListener(
    "resize",
    positionPopup
  );



  // SHOW
  let hideTimeout = null;

  let interacting = false;



  const showPopup = ()=>{

    clearTimeout(hideTimeout);

    positionPopup();

    wrapper.classList.remove(
      "hidden"
    );

  };



  // HIDE
  const hidePopup = ()=>{

    if(interacting)
      return;



    clearTimeout(hideTimeout);



    hideTimeout =
      setTimeout(()=>{

        if(
          !wrapper.matches(":hover")
        ){

          wrapper.classList.add(
            "hidden"
          );

        }

      },3000);

  };



  // TARGETS
  const hoverTargets = [

    input,
    input.parentElement,
    input.previousElementSibling

  ].filter(Boolean);



  hoverTargets.forEach(el=>{

    el.addEventListener(
      "mouseenter",
      showPopup
    );



    el.addEventListener(
      "mouseleave",
      hidePopup
    );



    el.addEventListener(
      "focus",
      showPopup
    );



    el.addEventListener(
      "click",
      showPopup
    );

  });



  wrapper.addEventListener(
    "mouseenter",
    ()=>{

      interacting = true;

      showPopup();

  });



  wrapper.addEventListener(
    "mouseleave",
    ()=>{

      interacting = false;

      hidePopup();

  });



  // CLOSE
  box.querySelector(
    ".qd-close"
  )

  .addEventListener(
    "click",
    ()=>{

      wrapper.classList.add(
        "hidden"
      );

  });



  // FILE NAME
  const fileNameElement =
    box.querySelector(
      ".qd-file-name"
    );



  // UPLOAD
  box.querySelector(
    ".qd-upload-btn"
  )

  .addEventListener(
    "click",
    async()=>{

      await injectFile(
        input,
        selectedDoc,
        wrapper
      );

  });



  // CHOOSE ANOTHER
  const chooser =
    box.querySelector(
      ".qd-chooser"
    );



  box.querySelector(
    ".qd-another"
  )

  .addEventListener(
    "click",
    ()=>{

      interacting = true;



      chooser.classList.toggle(
        "hidden"
      );

  });



  // SEARCH
  const searchInput =
    box.querySelector(
      ".qd-search"
    );



  searchInput.addEventListener(
    "focus",
    ()=>{

      interacting = true;

  });



  searchInput.addEventListener(
    "input",
    ()=>{

      const value =
        searchInput.value
        .toLowerCase();



      box.querySelectorAll(
        ".qd-doc-item"
      )

      .forEach(item=>{

        const matched =
          item.innerText
          .toLowerCase()
          .includes(value);



        item.style.display =
          matched
          ? "block"
          : "none";

      });

  });



  // SELECT DOC
  box.querySelectorAll(
    ".qd-doc-item"
  )

  .forEach(item=>{

    item.addEventListener(
      "click",
      ()=>{

        const docId =
          Number(item.dataset.id);



        const clickedDoc =
          documents.find(doc=>{

            return (
              doc.id === docId
            );

        });



        if(clickedDoc){

          selectedDoc =
            clickedDoc;



          fileNameElement.innerText =
            clickedDoc.name;



          chooser.classList.add(
            "hidden"
          );

        }

    });

  });

}



// INJECT FILE
async function injectFile(
  input,
  doc,
  wrapper = null
){

  try{

    console.log("DOC:", doc);
console.log("BUFFER:", doc.buffer);
console.log(
  "IS ARRAYBUFFER:",
  doc.buffer instanceof ArrayBuffer
);


const uint8Array =
  new Uint8Array(
    doc.buffer
  );

const blob =
  new Blob(

    [uint8Array],

    {
      type:
        doc.type ||
        "application/octet-stream"
    }

  );

const realFile =
  new File(

    [blob],

    doc.name,

    {
      type:
        doc.type ||
        "application/octet-stream",

      lastModified:
        doc.lastModified ||
        Date.now()
    }

  );

console.log("REAL FILE:", realFile);
console.log("NAME:", realFile.name);
console.log("TYPE:", realFile.type);
console.log("SIZE:", realFile.size);
console.log("IS FILE:", realFile instanceof File);

const dataTransfer =
  new DataTransfer();

dataTransfer.items.add(
  realFile
);


    input.files =
      dataTransfer.files;



    input.dispatchEvent(

      new Event(
        "change",
        {
          bubbles:true
        }
      )

    );



    // SUCCESS UI
    if(wrapper){

      const box =
        wrapper.querySelector(
          ".quickdocs-box"
        );



      box.innerHTML = `

        <button class="qd-close">
          ✕
        </button>



        <div class="qd-upload-success-wrap">

          <div class="qd-success">

            ✅ Uploaded

          </div>



          <div class="qd-uploaded-file">

            ${doc.name}

          </div>



          <button class="qd-change-btn">

            Change

          </button>

        </div>

      `;



      // CLOSE
      box.querySelector(
        ".qd-close"
      )

      .addEventListener(
        "click",
        ()=>{

          wrapper.classList.add(
            "hidden"
          );

      });



      // CHANGE
      box.querySelector(
        ".qd-change-btn"
      )

      .addEventListener(
        "click",
        ()=>{

          wrapper.remove();



          input.dataset.quickdocsAttached =
            "";



          input.dataset.quickdocsChecked =
            "";



          analyzeUploadContext(
            input
          );



          setTimeout(()=>{

            const event =
              new Event(
                "mouseenter"
              );



            input.dispatchEvent(
              event
            );

          },100);

      });

    }

  }

  catch(error){

    console.error(
      "UPLOAD ERROR:",
      error
    );

  }

}



// INIT
detectUploadFields();



// OBSERVER
const observer =
  new MutationObserver(()=>{

    detectUploadFields();

});



observer.observe(
  document.body,
  {
    childList:true,
    subtree:true
  }
);