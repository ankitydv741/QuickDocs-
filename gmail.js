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
// SHARED POSITIONING LOGIC
// Used by both the initial popup
// and the post-upload success view,
// since the box height changes when
// the chooser opens/closes and both
// need to reposition correctly.
// --------------------------------

function positionPopup(wrapper, box, attachButton) {

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

    // Tracks every doc successfully attached in THIS compose
    // window so the success screen can list them all and
    // "Add More" can keep appending without losing history.
    let uploadedDocs = [];

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

                        <span class="qd-check">☐</span> 📄 ${doc.name}

                    </div>

                `).join("")}

            </div>

            <button class="qd-attach-selected-btn" disabled>
                Attach Selected
            </button>

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

        positionPopup(wrapper, box, attachButton);

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

                wrapper,

                documents,

                uploadedDocs

            );

        });


    // --------------------------------
    // CHOOSE ANOTHER
    // --------------------------------

    box.querySelector(".qd-another")
        .addEventListener("click", () => {

            interacting = true;

            chooser.classList.toggle("hidden");

            // The box just grew/shrank (chooser has a
            // search bar + list + button), so re-measure
            // and reposition immediately rather than
            // waiting for the next scroll/resize event.
            position();

            requestAnimationFrame(position);

        });

    searchInput.addEventListener("focus", () => {

        interacting = true;

    });


    // --------------------------------
    // MULTI-SELECT + ATTACH SELECTED
    // --------------------------------

    setupChooserMultiSelect(

        chooser,

        documents,

        async (doc) => {

            await injectFileGmail(

                fileInput,

                doc,

                attachButton,

                wrapper,

                documents,

                uploadedDocs

            );

        }

    );

    console.log("QuickDocs Gmail Ready");

}


// --------------------------------
// MULTI-SELECT CHOOSER WIRING
// (shared by the initial popup's
// chooser and the post-upload
// "Add More" chooser)
// --------------------------------

function setupChooserMultiSelect(

    chooser,

    documents,

    onAttachSelected

) {

    const searchInput =
        chooser.querySelector(".qd-search");

    const attachSelectedBtn =
        chooser.querySelector(".qd-attach-selected-btn");

    const selectedIds = new Set();

    searchInput.addEventListener("input", () => {

        const value =
            searchInput.value.toLowerCase();

        chooser.querySelectorAll(".qd-doc-item")
            .forEach(item => {

                const matched =
                    item.innerText
                        .toLowerCase()
                        .includes(value);

                item.style.display =
                    matched ? "flex" : "none";

            });

    });

    chooser.querySelectorAll(".qd-doc-item")
        .forEach(item => {

            item.addEventListener("click", () => {

                const docId =
                    Number(item.dataset.id);

                const check =
                    item.querySelector(".qd-check");

                if (selectedIds.has(docId)) {

                    selectedIds.delete(docId);

                    item.classList.remove("qd-doc-item-selected");

                    if (check) check.textContent = "☐";

                } else {

                    selectedIds.add(docId);

                    item.classList.add("qd-doc-item-selected");

                    if (check) check.textContent = "☑";

                }

                attachSelectedBtn.disabled =
                    selectedIds.size === 0;

            });

        });

    attachSelectedBtn.addEventListener("click", async () => {

        const picked =
            documents.filter(doc =>
                selectedIds.has(doc.id)
            );

        if (!picked.length) return;

        attachSelectedBtn.disabled = true;

        attachSelectedBtn.textContent = "Attaching...";

        // Sequential, not parallel — dispatching several
        // "change" events on the same input back-to-back
        // without waiting can cause Gmail to drop some of
        // them, so each attach waits for the previous one.
        for (const doc of picked) {

            await onAttachSelected(doc);

        }

        selectedIds.clear();

        chooser.querySelectorAll(".qd-doc-item")
            .forEach(item => {

                item.classList.remove("qd-doc-item-selected");

                const check =
                    item.querySelector(".qd-check");

                if (check) check.textContent = "☐";

            });

        attachSelectedBtn.disabled = true;

        attachSelectedBtn.textContent = "Attach Selected";

        chooser.classList.add("hidden");

    });

}


// --------------------------------
// INJECT FILE (Gmail-specific,
// with drop-event fallback)
// --------------------------------

async function injectFileGmail(

    fileInput,

    doc,

    attachButton,

    wrapper,

    documents,

    uploadedDocs

) {

    try {

        const composeRoot =
            attachButton.closest('div[role="dialog"]') ||
            document;

        // Gmail can swap out the hidden file input between
        // attach actions, so re-query it fresh here rather
        // than trusting the reference captured when the
        // popup first opened. Falls back to the original
        // reference if a fresh one can't be found.
        const currentFileInput =
            composeRoot.querySelector('input[type="file"]') ||
            fileInput;

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
        currentFileInput.files =
            dataTransfer.files;

        currentFileInput.dispatchEvent(

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

        // Record this doc as attached (avoid duplicate
        // back-to-back entries if the same doc is clicked twice)
        if (
            !uploadedDocs.length ||
            uploadedDocs[uploadedDocs.length - 1].id !== doc.id
        ) {

            uploadedDocs.push(doc);

        }

        showUploadSuccess(

            wrapper,

            uploadedDocs,

            documents,

            attachButton,

            fileInput

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

    uploadedDocs,

    documents,

    attachButton,

    fileInput

) {

    const box =
        wrapper.querySelector(".quickdocs-box");

    const uploadedListHTML =
        uploadedDocs.map(d => `

            <div class="qd-uploaded-file">
                📄 ${d.name}
            </div>

        `).join("");

    box.innerHTML = `

        <button class="qd-close">
            ✕
        </button>

        <div class="qd-upload-success-wrap">

            <div class="qd-success">
                ✅ Uploaded
            </div>

            ${uploadedListHTML}

            <div class="qd-success-actions">

                <button class="qd-addmore-btn">
                    Add More
                </button>

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

                            <span class="qd-check">☐</span> 📄 ${doc.name}

                        </div>

                    `).join("")}

                </div>

                <button class="qd-attach-selected-btn" disabled>
                    Attach Selected
                </button>

            </div>

        </div>

    `;

    const chooser =
        box.querySelector(".qd-chooser");

    const searchInput =
        box.querySelector(".qd-search");

    // The box just switched from the "Suggested" view to
    // the "Uploaded" success view — its height changed, so
    // reposition immediately instead of waiting for the
    // next scroll/resize event.
    positionPopup(wrapper, box, attachButton);

    requestAnimationFrame(() =>
        positionPopup(wrapper, box, attachButton)
    );


    // --------------------------------
    // CLOSE
    // --------------------------------

    box.querySelector(".qd-close")
        .addEventListener("click", () => {

            wrapper.classList.add("hidden");

        });


    // --------------------------------
    // ADD MORE — reopen the same
    // search/list chooser inline,
    // without losing the uploaded
    // history above it
    // --------------------------------

    box.querySelector(".qd-addmore-btn")
        .addEventListener("click", () => {

            chooser.classList.toggle("hidden");

            if (!chooser.classList.contains("hidden")) {

                searchInput.focus();

            }

            // Box height just changed (chooser opened/closed)
            // — reposition immediately instead of waiting for
            // the next scroll/resize event.
            positionPopup(wrapper, box, attachButton);

            requestAnimationFrame(() =>
                positionPopup(wrapper, box, attachButton)
            );

        });


    // --------------------------------
    // MULTI-SELECT + ATTACH SELECTED
    // --------------------------------

    setupChooserMultiSelect(

        chooser,

        documents,

        async (doc) => {

            // Re-uses the same injection path as the
            // first upload — appends rather than replaces,
            // and re-renders this success screen with the
            // new file added to the list.
            await injectFileGmail(

                fileInput,

                doc,

                attachButton,

                wrapper,

                documents,

                uploadedDocs

            );

        }

    );

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

// ankit yadav