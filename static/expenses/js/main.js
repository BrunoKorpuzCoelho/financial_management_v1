const modal = document.getElementById("modal")
const form = document.getElementById("transaction-form")
const tbody = document.getElementById("transactions-tbody")
const emptyState = document.getElementById("empty-state")
const grossValueInput = document.getElementById("gross-value")
const ivaRateSelect = document.getElementById("iva-rate")
const typeSelect = document.getElementById("type")
const ivaValueSpan = document.getElementById("iva-value")
const netValueSpan = document.getElementById("net-value")
const ivaValueInput = document.getElementById("iva-value-input")
const netValueInput = document.getElementById("net-value-input")
const ivaRateGroup = document.querySelector('.form-group:has(#iva-rate)') || ivaRateSelect.closest('.form-group')
const userType = document.body.getAttribute('data-user-type') || 'user'

let isEditing = false;
const modalTitle = document.querySelector('.modal-header h2');
const submitButton = document.querySelector('.btn-primary');

document.addEventListener("DOMContentLoaded", () => {
  updateCalculatedValues()
  renderTransactions() 

  grossValueInput.addEventListener("input", updateCalculatedValues)
  ivaRateSelect.addEventListener("change", updateCalculatedValues)
  
  typeSelect.addEventListener("change", handleTypeChange)
  
  form.addEventListener("submit", handleSubmit)
  
  updateIvaFieldVisibility()
})

function openModal() {
  modal.classList.add("show")
  document.body.style.overflow = "hidden"
  
  updateIvaFieldVisibility()
}

function closeModal() {
  modal.classList.remove("show")
  document.body.style.overflow = "auto"
  
  isEditing = false;
  if (modalTitle) modalTitle.textContent = 'Adicionar Transação';
  if (submitButton) submitButton.textContent = 'Adicionar';
  form.action = '/add-expenses';
  
  const expenseIdInput = document.getElementById('expense-id-input');
  if (expenseIdInput) expenseIdInput.value = '';
  
  form.reset()
  updateCalculatedValues()
  updateIvaFieldVisibility()
}

function handleTypeChange() {
  const type = typeSelect.value
  
  if (type === "despesa") {
    ivaRateSelect.value = "23" 
  }
  
  updateIvaFieldVisibility()
  
  updateCalculatedValues()
}

function updateIvaFieldVisibility() {
  if (!ivaRateGroup) return;
  ivaRateGroup.style.display = 'block';
  
  if (typeSelect.value === "despesa") {
    ivaRateSelect.value = "23";
  }
}

function goBack() {
  const pathParts = window.location.pathname.split('/');
  const company_id = pathParts[pathParts.length - 1];
  window.location.href = `/main-menu/${company_id}`;
}

function updateCalculatedValues() {
  const grossValue = Number.parseFloat(grossValueInput.value) || 0
  const ivaRate = Number.parseFloat(ivaRateSelect.value) || 0
  const type = typeSelect.value

  let ivaValue = 0
  let netValue = grossValue

  if (ivaRate > 0) {
    netValue = grossValue / (1 + (ivaRate / 100))
    ivaValue = grossValue - netValue
  }

  ivaValueSpan.textContent = formatCurrency(ivaValue)
  netValueSpan.textContent = formatCurrency(netValue)
  
  ivaValueInput.value = ivaValue.toFixed(2)
  netValueInput.value = netValue.toFixed(2)
}

function formatCurrency(value) {
  return new Intl.NumberFormat("pt-PT", {
    style: "currency",
    currency: "EUR",
    minimumFractionDigits: 2, 
    maximumFractionDigits: 2  
  }).format(value)
}

function handleLogout() {
  window.location.href = '/logout'
}

function handleSubmit(e) {
  const grossValue = Number.parseFloat(grossValueInput.value) || 0
  const ivaRate = Number.parseFloat(ivaRateSelect.value) || 0
  const type = typeSelect.value

  let ivaValue = 0
  let netValue = grossValue

  if (ivaRate > 0) {
    netValue = grossValue / (1 + (ivaRate / 100))
    ivaValue = grossValue - netValue
  }

  ivaValueInput.value = ivaValue.toFixed(2)
  netValueInput.value = netValue.toFixed(2)
  
  if (isEditing) {
    const currentPage = new URLSearchParams(window.location.search).get('page');
    if (currentPage) {
      const separator = form.action.includes('?') ? '&' : '?';
      form.action = `${form.action}${separator}page=${currentPage}`;
    }
  }
}

function renderTransactions() {
  const tableRows = document.querySelectorAll("#transactions-tbody tr");
  
  if (tableRows.length === 0) {
    emptyState.style.display = "block";
  } else {
    emptyState.style.display = "none";
  }
}

function editTransaction(id) {
  id = parseInt(id);
  
  if (isNaN(id)) {
    console.error('ID inválido:', id);
    alert("Erro: ID de transação inválido");
    return;
  }
  
  fetch(`/get-expense/${id}`)
    .then(response => response.json())
    .then(data => {
      if (data.success) {
        const expense = data.expense;
        
        const expenseIdInput = document.getElementById('expense-id-input');
        if (expenseIdInput) expenseIdInput.value = expense.id;
        
        typeSelect.value = expense.transaction_type;
        document.getElementById('description').value = expense.description;
        grossValueInput.value = expense.gross_value;
        ivaRateSelect.value = expense.iva_rate;
        
        updateCalculatedValues();
        updateIvaFieldVisibility();
        
        isEditing = true;
        if (modalTitle) modalTitle.textContent = 'Editar Transação';
        if (submitButton) submitButton.textContent = 'Atualizar';
        
        form.action = `/update-expense/${id}`;
        
        openModal();
      } else {
        console.error('Erro ao buscar dados:', data.message);
        alert("Erro ao buscar dados da transação");
      }
    })
    .catch(error => {
      console.error('Erro:', error);
      alert("Erro ao processar a solicitação");
    });
}

function deleteTransaction(id) {
  id = parseInt(id);
  
  if (isNaN(id)) {
    console.error('ID inválido:', id);
    alert("Erro: ID de transação inválido");
    return;
  }
  
  if (confirm("Tem certeza que deseja eliminar esta transação?")) {
    const currentPage = new URLSearchParams(window.location.search).get('page') || 1;
    
    fetch(`/delete-expense/${id}`, {
      method: 'POST',
      headers: {
        'X-Requested-With': 'XMLHttpRequest',
        'Content-Type': 'application/json'
      }
    })
    .then(response => {
      if (response.ok) {
        const row = document.querySelector(`tr[data-id="${id}"]`);
        if (row) {
          row.remove();
          renderTransactions();
          
          const remainingRows = document.querySelectorAll("#transactions-tbody tr").length;
          if (remainingRows === 0 && currentPage > 1) {
            window.location.href = `/expenses?page=${parseInt(currentPage) - 1}`;
          }
        } else {
          window.location.href = `/expenses?page=${currentPage}`;
        }
      } else {
        response.json().then(data => {
          console.error('Erro na resposta:', data);
          alert(`Erro ao excluir a transação: ${data.message || 'Erro desconhecido'}`);
        }).catch(() => {
          alert("Erro ao excluir a transação");
        });
      }
    })
    .catch(error => {
      console.error('Erro na requisição:', error);
      alert("Erro ao processar a solicitação");
    });
  }
}

function goToPage(pageNum) {
  window.location.href = `/expenses?page=${pageNum}`;
}

modal.addEventListener("click", (e) => {
  if (e.target === modal) {
    closeModal()
  }
})

document.addEventListener("keydown", (e) => {
  if (e.key === "Escape" && modal.classList.contains("show")) {
    closeModal()
  }
})