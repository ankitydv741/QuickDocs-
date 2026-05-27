const DB_NAME = "QuickDocsDB";

const STORE_NAME = "documents";



// OPEN DATABASE
export function openDB(){

  return new Promise((resolve,reject)=>{

    const request =
      indexedDB.open(DB_NAME,1);

    request.onupgradeneeded = () => {

      const db = request.result;

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

    request.onsuccess = () => {

      resolve(request.result);
    };

    request.onerror = () => {

      reject(request.error);
    };

  });
}



// SAVE DOCUMENT
export async function saveDocument(doc){

  const db =
    await openDB();

  const transaction =
    db.transaction(
      STORE_NAME,
      "readwrite"
    );

  const store =
    transaction.objectStore(
      STORE_NAME
    );

  store.add(doc);

  return transaction.complete;
}



// GET DOCUMENTS
export async function getDocuments(){

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

    request.onsuccess = () => {

      resolve(request.result);
    };

    request.onerror = () => {

      reject(request.error);
    };

  });
}



// DELETE DOCUMENT
export async function deleteDocument(id){

  const db =
    await openDB();

  return new Promise((resolve,reject)=>{

    const transaction =
      db.transaction(
        STORE_NAME,
        "readwrite"
      );

    const store =
      transaction.objectStore(
        STORE_NAME
      );

    const request =
      store.delete(id);

    request.onsuccess = () => {

      resolve();
    };

    request.onerror = () => {

      reject(request.error);
    };

  });
}



// UPDATE DOCUMENT
export async function updateDocument(updatedDoc){

  const db =
    await openDB();

  return new Promise((resolve,reject)=>{

    const transaction =
      db.transaction(
        STORE_NAME,
        "readwrite"
      );

    const store =
      transaction.objectStore(
        STORE_NAME
      );

    const request =
      store.put(updatedDoc);

    request.onsuccess = () => {

      resolve();
    };

    request.onerror = () => {

      reject(request.error);
    };

  });
}
