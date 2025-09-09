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
const monthSelect = document.getElementById("month-select")
const yearSelect = document.getElementById("year-select")
const filterBtn = document.getElementById("filter-btn")

let isEditing = false;
const modalTitle = document.querySelector('.modal-header h2');
const submitButton = document.querySelector('.btn-primary');

// Variáveis para controle de data
let currentMonth = new Date().getMonth() + 1; // 1-12
let currentYear = new Date().getFullYear();

document.addEventListener("DOMContentLoaded", () => {
  updateCalculatedValues()
  renderTransactions() 

  // Preencher o seletor de anos (último 5 anos até o atual + 2 anos futuros)
  populateYearSelect()
  
  // Definir o mês e ano atuais nos seletores
  setInitialMonthAndYear()
  
  grossValueInput.addEventListener("input", updateCalculatedValues)
  ivaRateSelect.addEventListener("change", updateCalculatedValues)
  
  typeSelect.addEventListener("change", handleTypeChange)
  
  form.addEventListener("submit", handleSubmit)
  
  // Adicionar event listener para o botão de filtro
  filterBtn.addEventListener("click", applyFilters)
  
  updateIvaFieldVisibility()
  
  // Carregar dados financeiros
  loadFinancialData()
})

function populateYearSelect() {
  const currentYear = new Date().getFullYear();
  const startYear = currentYear - 5;
  const endYear = currentYear + 2;
  
  for (let year = startYear; year <= endYear; year++) {
    const option = document.createElement('option');
    option.value = year;
    option.textContent = year;
    yearSelect.appendChild(option);
  }
}

function setInitialMonthAndYear() {
  // Tentar obter o mês e ano dos parâmetros da URL
  const urlParams = new URLSearchParams(window.location.search);
  const urlMonth = urlParams.get('month');
  const urlYear = urlParams.get('year');
  
  const now = new Date();
  
  if (urlMonth) {
    monthSelect.value = urlMonth;
    currentMonth = parseInt(urlMonth);
  } else {
    monthSelect.value = now.getMonth() + 1;
    currentMonth = now.getMonth() + 1;
  }
  
  if (urlYear) {
    yearSelect.value = urlYear;
    currentYear = parseInt(urlYear);
  } else {
    yearSelect.value = now.getFullYear();
    currentYear = now.getFullYear();
  }
}

function applyFilters() {
  const selectedMonth = monthSelect.value;
  const selectedYear = yearSelect.value;
  const company_id = getCompanyIdFromUrl();
  
  // Atualizar os valores atuais
  currentMonth = parseInt(selectedMonth);
  currentYear = parseInt(selectedYear);
  
  // Redirecionar para a mesma página com os parâmetros de filtro
  // Usar o nome correto da rota conforme definido no backend
  window.location.href = `/simple-sales/${company_id}?month=${selectedMonth}&year=${selectedYear}`;
}

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
  form.action = '/add-simple-expenses';
  
  const expenseIdInput = document.getElementById('expense-id-input');
  if (expenseIdInput) expenseIdInput.value = '';
  
  form.reset()
  updateCalculatedValues()
  updateIvaFieldVisibility()
}

function handleTypeChange() {
  const type = typeSelect.value
  
  if (type === "despesa") {
    ivaRateSelect.value = "0"
  }
  
  updateIvaFieldVisibility()
  
  updateCalculatedValues()
}

function updateIvaFieldVisibility() {
  const type = typeSelect.value;
  
  if (!ivaRateGroup) return; 
  
  if (type === "despesa" && userType !== 'Admin') {
    ivaRateGroup.style.display = 'none';
  } else {
    ivaRateGroup.style.display = 'block';
  }
  
  if (type === "despesa") {
    ivaRateSelect.value = "0";
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

  if (type === "ganho" && ivaRate > 0) {
    ivaValue = grossValue * (ivaRate / 100)
    netValue = grossValue - ivaValue
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

  if (type === "ganho" && ivaRate > 0) {
    ivaValue = grossValue * (ivaRate / 100)
    netValue = grossValue - ivaValue
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
  
  // Adicionar os parâmetros de mês e ano ao formulário para manter o filtro após a submissão
  const monthParam = document.createElement('input');
  monthParam.type = 'hidden';
  monthParam.name = 'month';
  monthParam.value = currentMonth;
  form.appendChild(monthParam);
  
  const yearParam = document.createElement('input');
  yearParam.type = 'hidden';
  yearParam.name = 'year';
  yearParam.value = currentYear;
  form.appendChild(yearParam);
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
  
  fetch(`/get-simple-expense/${id}`)
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
        
        form.action = `/update-simple-expense/${id}`;
        
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
    
    fetch(`/delete-simple-expense/${id}`, {
      method: 'POST',
      headers: {
        'X-Requested-With': 'XMLHttpRequest',
        'Content-Type': 'application/json'
      }
    })
    .then(response => {
      if (response.ok) {
        return response.json().then(data => {
          const row = document.querySelector(`tr[data-id="${id}"]`);
          if (row) {
            row.remove();
            renderTransactions();
            
            const remainingRows = document.querySelectorAll("#transactions-tbody tr").length;
            if (remainingRows === 0 && currentPage > 1) {
              // Manter os parâmetros de mês e ano ao redirecionar
              const urlParams = new URLSearchParams(window.location.search);
              const month = urlParams.get('month') || currentMonth;
              const year = urlParams.get('year') || currentYear;
              
              window.location.href = `/simple-sales/${getCompanyIdFromUrl()}?page=${parseInt(currentPage) - 1}&month=${month}&year=${year}`;
            } else {
              // Recarregar os dados financeiros após excluir uma transação
              loadFinancialData();
            }
          } else {
            // Manter os parâmetros de mês e ano ao redirecionar
            const urlParams = new URLSearchParams(window.location.search);
            const month = urlParams.get('month') || currentMonth;
            const year = urlParams.get('year') || currentYear;
            
            window.location.href = `/simple-sales/${data.company_id}?page=${currentPage}&month=${month}&year=${year}`;
          }
        }).catch(error => {
          console.error('Erro ao processar resposta:', error);
          // Tentar recarregar a página se não conseguir processar a resposta
          window.location.reload();
        });
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
  // Manter os parâmetros de mês e ano ao navegar pelas páginas
  const urlParams = new URLSearchParams(window.location.search);
  const month = urlParams.get('month') || currentMonth;
  const year = urlParams.get('year') || currentYear;
  
  window.location.href = `/simple-sales/${getCompanyIdFromUrl()}?page=${pageNum}&month=${month}&year=${year}`;
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

// Função para buscar os dados financeiros da API
function loadFinancialData() {
  const company_id = getCompanyIdFromUrl();
  console.log("Carregando dados financeiros para empresa:", company_id, "mês:", currentMonth, "ano:", currentYear);
  
  fetch(`/api/simple-financial-summary?company_id=${company_id}&month=${currentMonth}&year=${currentYear}`)
    .then(response => response.json())
    .then(data => {
      console.log("Dados recebidos da API:", data);
      if (data.success) {
        updateFinancialCards(data.summary);
      } else {
        console.error('Erro ao carregar dados:', data.message);
      }
    })
    .catch(error => {
      console.error('Erro na requisição:', error);
    });
}

// Função para extrair o ID da empresa da URL
function getCompanyIdFromUrl() {
  const pathParts = window.location.pathname.split('/');
  return pathParts[pathParts.length - 1];
}

// Função para atualizar os valores nos cards financeiros
function updateFinancialCards(data) {
  // Se não houver dados, usar zeros
  const summary = data || {};
  
  document.getElementById('revenue-value').textContent = formatCurrency(summary.total_sales || 0);
  document.getElementById('expenses-value').textContent = formatCurrency(summary.total_costs || 0);
  document.getElementById('vat-value').textContent = formatCurrency(summary.total_vat || 0);
  document.getElementById('profit-value').textContent = formatCurrency(summary.profit || 0);
  
  updateChangeIndicator('revenue-change', summary.sales_change);
  updateChangeIndicator('expenses-change', summary.costs_change);
  updateChangeIndicator('profit-change', summary.profit_change);
  updateChangeIndicator('vat-change', summary.vat_change);
}

function updateChangeIndicator(elementId, changeValue) {
  const element = document.getElementById(elementId);
  
  if (!changeValue) {
    element.textContent = '0%';
    element.className = 'card-change neutral';
    return;
  }
  
  const formattedChange = (changeValue > 0 ? '+' : '') + changeValue.toFixed(1) + '%';
  element.textContent = formattedChange;
  
  if (changeValue > 0) {
    element.className = 'card-change positive';
  } else if (changeValue < 0) {
    element.className = 'card-change negative';
  } else {
    element.className = 'card-change neutral';
  }
}