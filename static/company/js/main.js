const addCompanyBtn = document.getElementById("addCompanyBtn")
const modalOverlay = document.getElementById("modalOverlay")
const modalClose = document.getElementById("modalClose")
const cancelBtn = document.getElementById("cancelBtn")
const companyForm = document.getElementById("companyForm")
const companiesGrid = document.querySelector(".companies-grid")
const submitBtn = document.querySelector(".btn-primary")
const modalTitle = document.querySelector(".modal-title")

let isEditing = false;

function openModal() {
  modalOverlay.classList.add("active")
  document.body.style.overflow = "hidden"
  setTimeout(() => {
    document.getElementById("companyName").focus()
  }, 300)
}

function closeModal() {
  modalOverlay.classList.remove("active")
  document.body.style.overflow = ""
  
  companyForm.reset()
  document.getElementById("companyId").value = ""
  isEditing = false
  modalTitle.textContent = "Nova Empresa"
  submitBtn.textContent = "Criar Empresa"
  companyForm.action = "/add-company"
}

addCompanyBtn.addEventListener("click", () => {
  isEditing = false
  modalTitle.textContent = "Nova Empresa"
  submitBtn.textContent = "Criar Empresa"
  companyForm.action = "/add-company"
  openModal()
})

modalClose.addEventListener("click", closeModal)
cancelBtn.addEventListener("click", closeModal)

modalOverlay.addEventListener("click", (e) => {
  if (e.target === modalOverlay) {
    closeModal()
  }
})

document.addEventListener("keydown", (e) => {
  if (e.key === "Escape" && modalOverlay.classList.contains("active")) {
    closeModal()
  }
})

function editCompany(event, companyId) {
  if (event) {
    event.stopPropagation()
  }
  
  isEditing = true
  modalTitle.textContent = "Editar Empresa"
  submitBtn.textContent = "Atualizar Empresa"
  
  // Buscar dados da empresa
  fetch(`/get-company/${companyId}`)
    .then(response => response.json())
    .then(data => {
      if (data.success) {
        const company = data.company
        
        document.getElementById("companyId").value = company.id
        document.getElementById("companyName").value = company.name
        document.getElementById("companyNif").value = company.tax_id || ''
        document.getElementById("companyLocation").value = company.location || ''
        document.getElementById("companyType").value = company.relationship_type || ''
        document.getElementById("companyPhone").value = company.phone || ''
        document.getElementById("companyEmail").value = company.email || ''
        document.getElementById("companyNotes").value = company.notes || ''
        
        companyForm.action = `/update-company/${companyId}`
        
        // Abrir modal
        openModal()
      } else {
        showErrorMessage(data.message || "Erro ao carregar dados da empresa")
      }
    })
    .catch(error => {
      showErrorMessage("Erro ao processar sua solicitação: " + error)
    })
}

companyForm.addEventListener("submit", async (e) => {
  e.preventDefault()
  
  try {
    const formData = new FormData(companyForm)
    const url = isEditing ? companyForm.action : '/add-company'
    
    const response = await fetch(url, {
      method: 'POST',
      body: formData
    })
    
    const result = await response.json()
    
    if (result.success) {
      closeModal()
      showSuccessMessage(isEditing ? "Empresa atualizada com sucesso!" : "Empresa criada com sucesso!")
      setTimeout(() => {
        window.location.reload()
      }, 1000)
    } else {
      showErrorMessage(result.message || "Erro ao processar operação")
    }
  } catch (error) {
    showErrorMessage("Erro ao processar sua solicitação")
  }
})

function selectCompany(selectedCard) {
  const companyId = selectedCard.dataset.company
  
  window.location.href = `/main-menu/${companyId}`
}

function showSuccessMessage(message) {
  const successDiv = document.createElement("div")
  successDiv.style.cssText = `
    position: fixed;
    top: 20px;
    right: 20px;
    background: #10b981;
    color: white;
    padding: 1rem 1.5rem;
    border-radius: 0.5rem;
    font-weight: 500;
    z-index: 1001;
    transform: translateX(100%);
    transition: transform 0.3s ease;
  `
  successDiv.textContent = message
  document.body.appendChild(successDiv)
  
  setTimeout(() => {
    successDiv.style.transform = "translateX(0)"
  }, 100)
  
  setTimeout(() => {
    successDiv.style.transform = "translateX(100%)"
    setTimeout(() => {
      document.body.removeChild(successDiv)
    }, 300)
  }, 3000)
}

function showErrorMessage(message) {
  const errorDiv = document.createElement("div")
  errorDiv.style.cssText = `
    position: fixed;
    top: 20px;
    right: 20px;
    background: #ef4444;
    color: white;
    padding: 1rem 1.5rem;
    border-radius: 0.5rem;
    font-weight: 500;
    z-index: 1001;
    transform: translateX(100%);
    transition: transform 0.3s ease;
  `
  errorDiv.textContent = message
  document.body.appendChild(errorDiv)
  
  setTimeout(() => {
    errorDiv.style.transform = "translateX(0)"
  }, 100)
  
  setTimeout(() => {
    errorDiv.style.transform = "translateX(100%)"
    setTimeout(() => {
      document.body.removeChild(errorDiv)
    }, 300)
  }, 3000)
}

document.addEventListener('DOMContentLoaded', function() {
  document.querySelectorAll(".company-card").forEach((card) => {
    card.addEventListener("click", function(e) {
      if (!e.target.closest('.edit-btn')) {
        selectCompany(this);
      }
    });
  });

  document.querySelectorAll(".edit-btn").forEach((btn) => {
    btn.addEventListener("click", function(e) {
      e.stopPropagation(); 
      const companyId = this.closest('.company-card').dataset.company;
      editCompany(e, companyId);
    });
  });
});

if ("ontouchstart" in window) {
  document.querySelectorAll(".company-card, .add-company-btn").forEach((element) => {
    element.addEventListener("touchstart", function () {
      this.style.transform = "scale(0.98)"
    })
    element.addEventListener("touchend", function () {
      this.style.transform = ""
    })
  })
}

function handleLogout() {
  window.location.href = '/logout'
}