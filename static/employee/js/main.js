let currentPage = 1
const itemsPerPage = 100
let employees = []
let isEditing = false;

function getCompanyId() {
  const pathParts = window.location.pathname.split('/');
  for (let i = 0; i < pathParts.length; i++) {
    if (pathParts[i] === 'employee' && i + 1 < pathParts.length) {
      return pathParts[i + 1];
    }
  }
  return null;
}

const companyId = getCompanyId();

const modalOverlay = document.getElementById("modalOverlay")
const addEmployeeBtn = document.getElementById("addEmployeeBtn")
const cancelBtn = document.getElementById("cancelBtn")
const employeesTableBody = document.getElementById("employeesTableBody")
const mobileCards = document.getElementById("mobileCards")
const pagination = document.getElementById("pagination")
const emptyState = document.getElementById("emptyState")
const prevBtn = document.getElementById("prevBtn")
const nextBtn = document.getElementById("nextBtn")
const pageNumbers = document.getElementById("pageNumbers")
const toast = document.getElementById("toast")
const toastMessage = document.getElementById("toastMessage")

const employeeForm = document.getElementById("employeeForm")
const employeeName = document.getElementById("employeeName")
const employeePosition = document.getElementById("employeePosition")
const employeeSalary = document.getElementById("employeeSalary")
const employeeSocialSecurity = document.getElementById("employeeSocialSecurity")
const employerSocialSecurity = document.getElementById("employerSocialSecurity")
const employeeIRS = document.getElementById("employeeIRS")
const extraPayment = document.getElementById("extraPayment")
const extraPaymentDescription = document.getElementById("extraPaymentDescription")
const employeeId = document.getElementById("employeeId")
const companyIdInput = document.getElementById("companyIdInput") 
const submitBtn = document.querySelector('.btn-primary');
const modalTitle = document.querySelector('.modal-header h2');

addEmployeeBtn.addEventListener("click", openModal)
cancelBtn.addEventListener("click", closeModal)
prevBtn.addEventListener("click", previousPage)
nextBtn.addEventListener("click", nextPage)

employeeForm.addEventListener("submit", function(e) {
  e.preventDefault()
  addEmployee()
})

function openModal() {
  modalOverlay.style.display = "flex"
  clearForm()
  
  if (companyIdInput && companyId) {
    companyIdInput.value = companyId;
  }
}

function closeModal() {
  modalOverlay.style.display = "none"
}

function clearForm() {
  employeeName.value = ""
  employeePosition.value = ""
  employeeSalary.value = ""
  employeeSocialSecurity.value = "11.00"
  employerSocialSecurity.value = "23.75"
  employeeIRS.value = "0.00"
  extraPayment.value = "0.00"
  extraPaymentDescription.value = ""
  employeeId.value = ""
  
  if (companyIdInput && companyId) {
    companyIdInput.value = companyId;
  }
  
  isEditing = false;
  submitBtn.textContent = "Adicionar";
  modalTitle.textContent = "Adicionar Novo Empregado";
}

async function addEmployee() {
  if (!employeeName.value || !employeePosition.value || !employeeSalary.value) {
    showToast("Por favor, preencha todos os campos obrigatórios.", "error")
    return
  }

  try {
    const formData = new FormData(employeeForm)
    
    if (!formData.has('company_id') && companyId) {
      formData.append('company_id', companyId);
    }
    
    const url = isEditing 
      ? `/update-employee/${employeeId.value}` 
      : '/add-employee';
    
    const response = await fetch(url, {
      method: 'POST',
      body: formData
    })
    
    const result = await response.json()
    
    if (result.success) {
      closeModal()
      showToast(result.message)
      await loadEmployees()
    } else {
      showToast(result.message, "error")
    }
  } catch (error) {
    showToast("Erro ao processar a solicitação: " + error.message, "error")
  }
}

async function deleteEmployee(id) {
  if (confirm("Tem certeza que deseja remover este empregado?")) {
    try {
      const response = await fetch(`/delete-employee/${id}`, {
        method: 'POST'
      })
      
      const result = await response.json()
      
      if (result.success) {
        showToast("Empregado removido com sucesso.")
        await loadEmployees()
      } else {
        showToast(result.message, "error")
      }
    } catch (error) {
      showToast("Erro ao processar a solicitação: " + error.message, "error")
    }
  }
}

async function archiveEmployee(id, currentStatus) {
  const action = currentStatus ? "arquivar" : "reativar";
  const actionPast = currentStatus ? "arquivado" : "reativado";
  
  if (confirm(`Tem certeza que deseja ${action} este empregado?`)) {
    try {
      const formData = new FormData();
      formData.append('is_active', !currentStatus);
      
      if (companyId) {
        formData.append('company_id', companyId);
      }
      
      const response = await fetch(`/toggle-employee-status/${id}`, {
        method: 'POST',
        body: formData
      });
      
      const result = await response.json();
      
      if (result.success) {
        showToast(`Empregado ${actionPast} com sucesso.`);
        await loadEmployees();
      } else {
        showToast(result.message, "error");
      }
    } catch (error) {
      showToast("Erro ao processar a solicitação: " + error.message, "error");
    }
  }
}

async function editEmployee(id) {
  try {
    const response = await fetch(`/get-employee/${id}`);
    const result = await response.json();
    
    if (result.success) {
      const employee = result.employee;
      
      employeeName.value = employee.name;
      employeePosition.value = employee.position;
      employeeSalary.value = employee.gross_salary;
      employeeSocialSecurity.value = employee.social_security_rate;
      employerSocialSecurity.value = employee.employer_social_security_rate || 23.75;
      employeeIRS.value = employee.irs_rate || 0;
      extraPayment.value = employee.extra_payment || 0;
      extraPaymentDescription.value = employee.extra_payment_description || '';
      employeeId.value = employee.id;
      
      if (companyIdInput) {
        companyIdInput.value = employee.company_id || companyId;
      }
      
      isEditing = true;
      submitBtn.textContent = "Atualizar";
      modalTitle.textContent = "Editar Empregado";
      
      modalOverlay.style.display = "flex";
    } else {
      showToast(result.message, "error");
    }
  } catch (error) {
    showToast(`Erro ao carregar dados do empregado: ${error.message}`, "error");
  }
}

function formatCurrency(value) {
  return new Intl.NumberFormat("pt-PT", {
    style: "currency",
    currency: "EUR",
  }).format(value)
}

function formatPercent(value) {
  return value ? `${value}%` : '0%';
}

function renderEmployees() {
  const totalPages = Math.ceil(employees.length / itemsPerPage)
  const startIndex = (currentPage - 1) * itemsPerPage
  const endIndex = startIndex + itemsPerPage
  const currentEmployees = employees.slice(startIndex, endIndex)

  if (employees.length === 0) {
    emptyState.style.display = "block"
    pagination.style.display = "none"
    employeesTableBody.innerHTML = ""
    mobileCards.innerHTML = ""
    return
  } else {
    emptyState.style.display = "none"
  }

  employeesTableBody.innerHTML = currentEmployees
    .map(
      (employee) => `
        <tr class="${employee.is_active ? '' : 'inactive-row'}">
            <td class="employee-name">${employee.name}</td>
            <td class="employee-position">${employee.position}</td>
            <td class="employee-salary">${formatCurrency(employee.gross_salary)}</td>
            <td class="employee-ss">${formatPercent(employee.social_security_rate)}</td>
            <td class="employer-ss">${formatPercent(employee.employer_social_security_rate)}</td>
            <td class="employee-irs">${formatPercent(employee.irs_rate)}</td>
            <td class="employee-extra">
                ${employee.extra_payment ? formatCurrency(employee.extra_payment) : '-'}
                ${employee.extra_payment_description ? `<small>(${employee.extra_payment_description})</small>` : ''}
            </td>
            <td class="employee-status">${employee.is_active ? 'Sim' : 'Não'}</td>
            <td>
                <div class="actions">
                    <button class="action-btn edit-btn" onclick="editEmployee(${employee.id})">
                        <svg class="icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                            <path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7"/>
                            <path d="m18.5 2.5 3 3L12 15l-4 1 1-4 9.5-9.5z"/>
                        </svg>
                    </button>
                    <button class="action-btn archive-btn" onclick="archiveEmployee(${employee.id}, ${employee.is_active})">
                        <svg class="icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                            <path d="M21 8v13H3V8"></path>
                            <path d="M1 3h22v5H1z"></path>
                            <path d="M10 12h4"></path>
                        </svg>
                    </button>
                    <button class="action-btn delete-btn" onclick="deleteEmployee(${employee.id})">
                        <svg class="icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                            <path d="m3 6 3 0 0 0"/>
                            <path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"/>
                            <line x1="10" x2="10" y1="11" y2="17"/>
                            <line x1="14" x2="14" y1="11" y2="17"/>
                        </svg>
                    </button>
                </div>
            </td>
        </tr>
    `,
    )
    .join("")

  mobileCards.innerHTML = currentEmployees
    .map(
      (employee) => `
        <div class="employee-card ${employee.is_active ? '' : 'inactive-card'}">
            <div class="card-content">
                <div class="card-info">
                    <div class="card-name">${employee.name}</div>
                    <div class="card-position">${employee.position}</div>
                    <div class="card-salary">${formatCurrency(employee.gross_salary)}</div>
                    <div class="card-details">
                        <div>SS Empregado: ${formatPercent(employee.social_security_rate)}</div>
                        <div>SS Empregador: ${formatPercent(employee.employer_social_security_rate)}</div>
                        <div>IRS: ${formatPercent(employee.irs_rate)}</div>
                        <div>Extra: ${employee.extra_payment ? formatCurrency(employee.extra_payment) : '-'}</div>
                        ${employee.extra_payment_description ? `<div class="card-extra-desc">${employee.extra_payment_description}</div>` : ''}
                    </div>
                    <div class="card-status">Ativo: ${employee.is_active ? 'Sim' : 'Não'}</div>
                </div>
                <div class="card-actions">
                    <button class="action-btn edit-btn" onclick="editEmployee(${employee.id})">
                        <svg class="icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                            <path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7"/>
                            <path d="m18.5 2.5 3 3L12 15l-4 1 1-4 9.5-9.5z"/>
                        </svg>
                    </button>
                    <button class="action-btn archive-btn" onclick="archiveEmployee(${employee.id}, ${employee.is_active})">
                        <svg class="icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                            <path d="M21 8v13H3V8"></path>
                            <path d="M1 3h22v5H1z"></path>
                            <path d="M10 12h4"></path>
                        </svg>
                    </button>
                    <button class="action-btn delete-btn" onclick="deleteEmployee(${employee.id})">
                        <svg class="icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                            <path d="m3 6 3 0 0 0"/>
                            <path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"/>
                            <line x1="10" x2="10" y1="11" y2="17"/>
                            <line x1="14" x2="14" y1="11" y2="17"/>
                        </svg>
                    </button>
                </div>
            </div>
        </div>
    `,
    )
    .join("")

  if (totalPages > 1) {
    pagination.style.display = "flex"
    renderPagination(totalPages)
  } else {
    pagination.style.display = "none"
  }
}

function renderPagination(totalPages) {
  prevBtn.disabled = currentPage === 1
  nextBtn.disabled = currentPage === totalPages

  let pagesToShow = [];
  
  pagesToShow.push(currentPage);
  
  if (currentPage > 1) {
    pagesToShow.unshift(currentPage - 1);
  }
  
  if (currentPage < totalPages) {
    pagesToShow.push(currentPage + 1);
  }
  
  pagesToShow = [...new Set(pagesToShow)].sort((a, b) => a - b);
  
  let paginationHTML = '';
  
  if (pagesToShow[0] > 1) {
    paginationHTML += `
      <button class="page-btn" onclick="goToPage(1)">1</button>
      ${pagesToShow[0] > 2 ? '<span class="pagination-ellipsis">...</span>' : ''}
    `;
  }
  
  pagesToShow.forEach(page => {
    paginationHTML += `
      <button class="page-btn ${currentPage === page ? "active" : ""}" onclick="goToPage(${page})">
        ${page}
      </button>
    `;
  });
  
  if (pagesToShow[pagesToShow.length - 1] < totalPages) {
    paginationHTML += `
      ${pagesToShow[pagesToShow.length - 1] < totalPages - 1 ? '<span class="pagination-ellipsis">...</span>' : ''}
      <button class="page-btn" onclick="goToPage(${totalPages})">${totalPages}</button>
    `;
  }
  
  pageNumbers.innerHTML = paginationHTML;
}

function previousPage() {
  if (currentPage > 1) {
    currentPage--
    renderEmployees()
  }
}

function nextPage() {
  const totalPages = Math.ceil(employees.length / itemsPerPage)
  if (currentPage < totalPages) {
    currentPage++
    renderEmployees()
  }
}

function goToPage(page) {
  currentPage = page
  renderEmployees()
}

function showToast(message, type = "success") {
  toastMessage.textContent = message
  toast.className = `toast ${type}`
  toast.style.display = "block"

  setTimeout(() => {
    toast.style.display = "none"
  }, 3000)
}

async function loadEmployees() {
  try {
    if (!companyId) {
      showToast("Erro: ID da empresa não encontrado na URL.", "error");
      return;
    }
    
    const response = await fetch(`/get-employees/${companyId}`);
    const data = await response.json();
    
    if (data.success) {
      employees = data.employees;
      renderEmployees();
    } else {
      showToast("Erro ao carregar empregados: " + data.message, "error");
    }
  } catch (error) {
    showToast("Erro ao comunicar com o servidor: " + error.message, "error");
  }
}

document.addEventListener("DOMContentLoaded", () => {
  if (companyIdInput && companyId) {
    companyIdInput.value = companyId;
  }
  
  loadEmployees();
})

function goBack() {
  const pathParts = window.location.pathname.split('/');
  const company_id = pathParts[pathParts.length - 1];
  window.location.href = `/main-menu/${company_id}`;
}

function handleLogout() {
  window.location.href = '/logout';
}