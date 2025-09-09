document.addEventListener("DOMContentLoaded", function () {
  checkSystemModal();
});

function checkSystemModal() {
  const pathParts = window.location.pathname.split("/");
  const company_id = companyId || pathParts[pathParts.length - 1];

  fetch(`/smodal?company_id=${company_id}`)
    .then((response) => response.json())
    .then((data) => {
      if (data.show && data.content) {
        showSystemModal(data.content, data.type || "info", data.title);
      }
    })
    .catch((error) => {
      console.error("Erro ao verificar mensagens do sistema:", error);
    });
}

function showSystemModal(content, type = "info", title = null) {
  const modal = document.getElementById("system-modal");
  const modalBody = document.getElementById("system-modal-body");

  modalBody.innerHTML = "";

  const messageDiv = document.createElement("div");
  messageDiv.className = `modal-message ${type}`;

  if (title) {
    const titleElement = document.createElement("h3");
    titleElement.className = "modal-title";
    titleElement.textContent = title;
    messageDiv.appendChild(titleElement);
  }

  const contentElement = document.createElement("div");
  contentElement.className = "modal-content";

  if (content.includes("<") && content.includes(">")) {
    contentElement.innerHTML = content;
  } else {
    contentElement.textContent = content;
  }

  messageDiv.appendChild(contentElement);

  const actionDiv = document.createElement("div");
  actionDiv.className = "modal-action";

  const actionButton = document.createElement("button");
  actionButton.className = "modal-button";
  actionButton.textContent = "OK";
  actionButton.onclick = closeSystemModal;

  actionDiv.appendChild(actionButton);
  messageDiv.appendChild(actionDiv);

  modalBody.appendChild(messageDiv);

  modal.classList.add("show");

  document.body.style.overflow = "hidden";
}

function closeSystemModal() {
  const modal = document.getElementById("system-modal");
  modal.classList.remove("show");

  document.body.style.overflow = "";
}

document.addEventListener("click", function (event) {
  const modal = document.getElementById("system-modal");
  if (event.target === modal) {
    closeSystemModal();
  }
});

document.addEventListener("keydown", function (event) {
  if (event.key === "Escape") {
    closeSystemModal();
  }
});

function displaySystemMessage(content, type = "info", title = null) {
  showSystemModal(content, type, title);
}

document.addEventListener('DOMContentLoaded', function() {
    setTimeout(checkSystemModal, 500);
});