// ================================
// QUICKDOCS GMAIL SUPPORT
// Full Version
// ================================

// Only run on Gmail
if (!location.hostname.includes("mail.google.com")) {
    throw new Error("QuickDocs Gmail module loaded outside Gmail.");
}

// Load existing CSS
const gmailStyle = document.createElement("link");

gmailStyle.rel = "stylesheet";

gmailStyle.href = chrome.runtime.getURL("style.css");

document.head.appendChild(gmailStyle);


// --------------------------------
// GET DOCUMENTS
// --------------------------------

async function getDocuments() {

    return new Promise(resolve => {

        chrome.runtime.sendMessage(

            {
                type: "GET_DOCUMENTS"
            },

            docs => {

                resolve(docs || []);

            }

        );

    });

}


// --------------------------------
// Detect Compose Windows
// --------------------------------

function detectComposeWindows() {

    const composeWindows = document.querySelectorAll(

        'div[role="dialog"]'

    );

    composeWindows.forEach(compose => {

        if (compose.dataset.quickdocsReady) return;

        compose.dataset.quickdocsReady = "true";

        setupCompose(compose);

    });

}


// --------------------------------
// Setup Compose Window
// --------------------------------

function setupCompose(compose) {

    console.log("QuickDocs → Compose detected");

    observeForAttachment(compose);

}


// --------------------------------
// Wait until Gmail creates
// the attachment input
// --------------------------------

function observeForAttachment(compose) {

    const tryFind = () => {

        const fileInput = compose.querySelector(

            'input[type="file"]'

        );

        const attachButton = findAttachButton(compose);

        if (!fileInput || !attachButton) return false;

        if (attachButton.dataset.quickdocsPopup) return true;

        createAttachPopup(

            attachButton,

            fileInput

        );

        return true;

    };

    // Try immediately in case it's already there
    if (tryFind()) return;

    const observer = new MutationObserver(() => {

        tryFind();

    });

    observer.observe(compose, {

        childList: true,

        subtree: true

    });

    // Keep the observer reference on the compose element
    // so it isn't garbage collected mid-watch, and so we
    // could disconnect it later if the compose window closes.
    compose.dataset.quickdocsObserverAttached = "true";

}


// --------------------------------
// Find Gmail Paperclip Button
// --------------------------------

function findAttachButton(compose) {

    const candidates = compose.querySelectorAll(

        '[command="Files"], [aria-label*="Attach" i], [data-tooltip*="Attach" i]'

    );

    if (candidates.length) return candidates[0];

    // Fallback to the broader scan if the attribute-based
    // lookup finds nothing (Gmail markup can vary slightly
    // between compose types).
    const buttons = compose.querySelectorAll("div");

    for (const btn of buttons) {

        const label =

            btn.getAttribute("aria-label") ||

            "";

        if (

            label.toLowerCase().includes("attach")

        ) {

            return btn;

        }

    }

    return null;

}


// --------------------------------
// Create Suggestion Popup
// --------------------------------

async function createAttachPopup(

    attachButton,

    fileInput

) {

    console.log("CREATE POPUP CALLED");

    if (attachButton.dataset.quickdocsPopup)

        return;

    attachButton.dataset.quickdocsPopup = "true";

    const documents = await getDocuments();

    console.log(documents);

    if (!documents.length)
        return;

    let selectedDoc = documents[0];

    const wrapper = document.createElement("div");

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
                class="qd-search"
                placeholder="Search..."
            >

            <div class="qd-doc-list">

                ${documents.map(doc => `

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

    document.body.appendChild(wrapper);

    console.log("WRAPPER ADDED");

    const box =
        wrapper.querySelector(".quickdocs-box");

    const chooser =
        wrapper.querySelector(".qd-chooser");

    const fileNameElement =
        wrapper.querySelector(".qd-file-name");

    const searchInput =
        wrapper.querySelector(".qd-search");


    // --------------------------------
    // POSITION
    // --------------------------------

    function position() {

        const rect =

            attachButton.getBoundingClientRect();

        wrapper.style.position = "fixed";

        // Measure the popup itself so we know how much
        // room it actually needs (box.offsetHeight is 0
        // until it's rendered, so read it live each time).
        const popupHeight =
            box.offsetHeight || 260;

        const popupWidth =
            box.offsetWidth || 180;

        const spaceBelow =
            window.innerHeight - rect.top;

        const spaceAbove =
            rect.bottom;

        let top;

        if (spaceBelow >= popupHeight + 10) {

            // enough room below → open downward
            top = rect.top - 10;

        } else if (spaceAbove >= popupHeight + 10) {

            // not enough below, but enough above → open upward
            top = rect.bottom - popupHeight + 10;

        } else {

            // neither side has full room → clamp inside viewport
            top = Math.max(
                10,
                window.innerHeight - popupHeight - 10
            );

        }

        let left =
            rect.right + 8;

        // Also guard against overflowing the right edge
        if (left + popupWidth > window.innerWidth) {

            left =
                rect.left - popupWidth - 8;

        }

        wrapper.style.top = top + "px";

        wrapper.style.left = left + "px";

    }

    position();

    window.addEventListener(
        "resize",
        position
    );

    window.addEventListener(
        "scroll",
        position,
        true
    );


    // --------------------------------
    // SHOW / HIDE
    // --------------------------------

    let hideTimeout = null;
    let interacting = false;

    const showPopup = () => {

        clearTimeout(hideTimeout);

        wrapper.classList.remove("hidden");

        // Position twice: once immediately (uses fallback
        // height if not yet measured), then again next frame
        // once the browser has laid out the now-visible box,
        // so the flip-up/clamp logic uses real dimensions.
        position();

        requestAnimationFrame(position);

    };

    const hidePopup = () => {

        if (interacting) return;

        clearTimeout(hideTimeout);

        hideTimeout = setTimeout(() => {

            if (!wrapper.matches(":hover")) {

                wrapper.classList.add("hidden");

            }

        }, 2000);

    };

    attachButton.addEventListener("mouseenter", showPopup);
    attachButton.addEventListener("mouseleave", hidePopup);
    attachButton.addEventListener("click", showPopup);
    attachButton.addEventListener("focus", showPopup);

    wrapper.addEventListener("mouseenter", () => {

        interacting = true;

        showPopup();

    });

    wrapper.addEventListener("mouseleave", () => {

        interacting = false;

        hidePopup();

    });


    // --------------------------------
    // CLOSE
    // --------------------------------

    box.querySelector(".qd-close")
        .addEventListener("click", () => {

            wrapper.classList.add("hidden");

        });


    // --------------------------------
    // UPLOAD
    // --------------------------------

    box.querySelector(".qd-upload-btn")
        .addEventListener("click", async () => {

            await injectFileGmail(

                fileInput,

                selectedDoc,

                attachButton,

                wrapper

            );

        });


    // --------------------------------
    // CHOOSE ANOTHER
    // --------------------------------

    box.querySelector(".qd-another")
        .addEventListener("click", () => {

            interacting = true;

            chooser.classList.toggle("hidden");

        });


    // --------------------------------
    // SEARCH
    // --------------------------------

    searchInput.addEventListener("focus", () => {

        interacting = true;

    });

    searchInput.addEventListener("input", () => {

        const value =
            searchInput.value.toLowerCase();

        box.querySelectorAll(".qd-doc-item")
            .forEach(item => {

                const matched =
                    item.innerText
                        .toLowerCase()
                        .includes(value);

                item.style.display =
                    matched ? "block" : "none";

            });

    });


    // --------------------------------
    // SELECT DOC FROM LIST
    // --------------------------------

    box.querySelectorAll(".qd-doc-item")
        .forEach(item => {

            item.addEventListener("click", () => {

                const docId =
                    Number(item.dataset.id);

                const clickedDoc =
                    documents.find(doc => doc.id === docId);

                if (clickedDoc) {

                    selectedDoc = clickedDoc;

                    fileNameElement.innerText =
                        clickedDoc.name;

                    chooser.classList.add("hidden");

                }

            });

        });

    console.log("QuickDocs Gmail Ready");

}


// --------------------------------
// INJECT FILE (Gmail-specific,
// with drop-event fallback)
// --------------------------------

async function injectFileGmail(

    fileInput,

    doc,

    attachButton,

    wrapper

) {

    try {

        const uint8Array =
            new Uint8Array(doc.buffer);

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

        const dataTransfer =
            new DataTransfer();

        dataTransfer.items.add(realFile);


        // ATTEMPT 1 — standard input + change event
        fileInput.files =
            dataTransfer.files;

        fileInput.dispatchEvent(

            new Event(
                "change",
                { bubbles: true }
            )

        );


        // Give Gmail a moment to react, then check whether
        // an attachment chip appeared in the compose body.
        await new Promise(resolve =>
            setTimeout(resolve, 500)
        );

        const composeRoot =
            attachButton.closest('div[role="dialog"]') ||
            document;

        const uploadedIndicator =
            [...composeRoot.querySelectorAll('[aria-label], [title]')]
                .find(el => {

                    const label =
                        (el.getAttribute("aria-label") || "") +
                        (el.getAttribute("title") || "");

                    return label.includes(doc.name);

                });

        if (!uploadedIndicator) {

            console.log(
                "QuickDocs: change event didn't register, trying drop fallback"
            );

            // ATTEMPT 2 — simulate drop on the compose body
            const dropTarget =
                composeRoot.querySelector('[contenteditable="true"]') ||
                composeRoot;

            try {

                const dropEvent = new DragEvent("drop", {
                    bubbles: true,
                    cancelable: true,
                    dataTransfer: dataTransfer
                });

                dropTarget.dispatchEvent(dropEvent);

            } catch (dropError) {

                console.warn(
                    "QuickDocs: drop fallback unsupported in this browser",
                    dropError
                );

            }

        }

        showUploadSuccess(

            wrapper,

            doc,

            fileInput,

            attachButton

        );

    } catch (error) {

        console.error(
            "QUICKDOCS GMAIL UPLOAD ERROR:",
            error
        );

    }

}


// --------------------------------
// SUCCESS UI + CHANGE
// --------------------------------

function showUploadSuccess(

    wrapper,

    doc,

    fileInput,

    attachButton

) {

    const box =
        wrapper.querySelector(".quickdocs-box");

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

    box.querySelector(".qd-close")
        .addEventListener("click", () => {

            wrapper.classList.add("hidden");

        });

    box.querySelector(".qd-change-btn")
        .addEventListener("click", () => {

            wrapper.remove();

            attachButton.dataset.quickdocsPopup = "";

            createAttachPopup(

                attachButton,

                fileInput

            );

        });

}


// --------------------------------
// Watch Gmail
// --------------------------------

const gmailObserver = new MutationObserver(() => {

    detectComposeWindows();

});

gmailObserver.observe(

    document.body,

    {

        childList: true,

        subtree: true

    }

);

detectComposeWindows();
