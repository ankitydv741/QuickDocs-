import {
  saveDocument,
  getDocuments,
  deleteDocument,
  updateDocument
}
from "./utils/db.js";



const addBtn =
  document.getElementById("addBtn");

const fileInput =
  document.getElementById("fileInput");

const docList =
  document.getElementById("docList");

const searchInput =
  document.getElementById("searchInput");



const editModal =
  document.getElementById("editModal");

const editName =
  document.getElementById("editName");

const editCategory =
  document.getElementById("editCategory");

const editTags =
  document.getElementById("editTags");

const replaceFile =
  document.getElementById("replaceFile");

const saveChangesBtn =
  document.getElementById(
    "saveChangesBtn"
  );



let currentEditingDoc = null;

let allDocuments = [];



// OPEN FILE PICKER
addBtn.addEventListener(
  "click",
  ()=>{

    fileInput.click();

});



// SAVE FILE
fileInput.addEventListener(
  "change",
  async(e)=>{

    const file =
      e.target.files[0];



    if(!file) return;



   const buffer =
  await file.arrayBuffer();

const documentData = {

  name:file.name,

  category:"General",

  tags:[],

  buffer:buffer,

  type:file.type,

  lastModified:
    file.lastModified,

  createdAt:
    new Date().toISOString()

};



    await saveDocument(
      documentData
    );



    loadDocuments();

});



// SEARCH
searchInput.addEventListener(
  "input",
  ()=>{

    const value =
      searchInput.value
      .toLowerCase();



    const filtered =
      allDocuments.filter(doc=>{

        const tags =
          (
            doc.tags || []
          ).join(" ");



        return (

          doc.name
          .toLowerCase()
          .includes(value)

          ||

          doc.category
          .toLowerCase()
          .includes(value)

          ||

          tags
          .toLowerCase()
          .includes(value)

        );

    });



    renderDocuments(
      filtered
    );

});



// ENTER KEY NAVIGATION
editName.addEventListener(
  "keydown",
  (e)=>{

    if(e.key === "Enter"){

      e.preventDefault();

      editCategory.focus();

    }

});



editCategory.addEventListener(
  "keydown",
  (e)=>{

    if(e.key === "Enter"){

      e.preventDefault();

      editTags.focus();

    }

});



editTags.addEventListener(
  "keydown",
  async(e)=>{

    if(e.key === "Enter"){

      e.preventDefault();

      await saveCurrentDocument();

    }

});



// LOAD DOCUMENTS
async function loadDocuments(){

  const docs =
    await getDocuments();



  allDocuments = docs;



  renderDocuments(docs);

}



// RENDER DOCUMENTS
function renderDocuments(docs){

  docList.innerHTML = "";



  docs.forEach(doc=>{

    const row =
      document.createElement("div");



    row.className =
      "doc-row";



    row.innerHTML = `

      <div class="doc-left clickable-file">

        📄 ${doc.name}

        <div class="doc-meta">

          ${doc.category}

        </div>

      </div>



      <div class="doc-actions">

        <button class="edit-btn">
          ✏️
        </button>

        <button class="delete-btn">
          🗑️
        </button>

      </div>

    `;



    // OPEN FILE
   row.querySelector(
  ".clickable-file"
)
.addEventListener(
  "click",
  ()=>{

    if(!doc.buffer)
      return;

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

    const url =
      URL.createObjectURL(
        blob
      );

    window.open(
      url,
      "_blank"
    );

});



    // DELETE
    row.querySelector(
      ".delete-btn"
    )

    .addEventListener(
      "click",
      async()=>{

        const confirmDelete =
          confirm(
            `Delete ${doc.name}?`
          );



        if(!confirmDelete)
          return;



        await deleteDocument(
          doc.id
        );



        loadDocuments();

    });



    // EDIT
    row.querySelector(
      ".edit-btn"
    )

    .addEventListener(
      "click",
      ()=>{

        currentEditingDoc =
          doc;



        editName.value =
          doc.name;



        editCategory.value =
          doc.category;



        editTags.value =
          (
            doc.tags || []
          ).join(", ");



        editModal.classList.remove(
          "hidden"
        );



        // AUTO FOCUS
        setTimeout(()=>{

          editName.focus();

        },100);

    });



    docList.appendChild(row);

  });

}



// SAVE DOCUMENT FUNCTION
async function saveCurrentDocument(){

  if(!currentEditingDoc)
    return;



  const newFile =
    replaceFile.files[0];



  currentEditingDoc.name =
    editName.value;



  currentEditingDoc.category =
    editCategory.value;



  currentEditingDoc.tags =

    editTags.value

    .split(",")

    .map(tag=>tag.trim())

    .filter(tag=>tag);



 if(newFile){

  currentEditingDoc.buffer =
    await newFile.arrayBuffer();

  currentEditingDoc.type =
    newFile.type;

  currentEditingDoc.lastModified =
    newFile.lastModified;

}


  await updateDocument(
    currentEditingDoc
  );



  editModal.classList.add(
    "hidden"
  );



  loadDocuments();

}



// SAVE BUTTON
saveChangesBtn.addEventListener(
  "click",
  async()=>{

    await saveCurrentDocument();

});



// INITIAL LOAD
loadDocuments();