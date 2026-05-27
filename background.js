const DB_NAME =
  "QuickDocsDB";

const STORE_NAME =
  "documents";



// OPEN DATABASE
function openDB(){

  return new Promise((resolve,reject)=>{

    const request =
      indexedDB.open(
        DB_NAME,
        1
      );



    request.onupgradeneeded =
      ()=>{

      const db =
        request.result;



      if(
        !db.objectStoreNames.contains(
          STORE_NAME
        )
      ){

        db.createObjectStore(
          STORE_NAME,
          {
            keyPath:"id",
            autoIncrement:true
          }
        );
      }
    };



    request.onsuccess =
      ()=>{

      resolve(request.result);
    };



    request.onerror =
      ()=>{

      reject(request.error);
    };

  });
}



// GET DOCUMENTS
async function getDocuments(){

  const db =
    await openDB();



  return new Promise((resolve,reject)=>{

    const transaction =
      db.transaction(
        STORE_NAME,
        "readonly"
      );



    const store =
      transaction.objectStore(
        STORE_NAME
      );



    const request =
      store.getAll();



    request.onsuccess =
      ()=>{

      resolve(request.result);
    };



    request.onerror =
      ()=>{

      reject(request.error);
    };

  });
}



// LISTEN FOR MESSAGES
chrome.runtime.onMessage.addListener(

  (message,sender,sendResponse)=>{

    if(
      message.type ===
      "GET_DOCUMENTS"
    ){

      getDocuments()
      .then(docs=>{

        sendResponse(docs);

      });



      return true;
    }

});