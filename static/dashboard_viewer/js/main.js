let currentChart = null;
let currentMonth = new Date().getMonth();
let currentYear = new Date().getFullYear();
let currentTransactionType = "";
let currentPage = 1;
let totalPages = 1;
let transactionsPerPage = 10;
let allTransactions = [];
let profitChart = null;
let vatAnalysisChart = null;
let availableMonths = [];
let selectedMonths = [];
let vatMonthlyData = [];
// Variáveis para o modal de funcionários
let employeeChart = null;
let employeeData = [];

const months = [
  "Janeiro",
  "Fevereiro",
  "Março",
  "Abril",
  "Maio",
  "Junho",
  "Julho",
  "Agosto",
  "Setembro",
  "Outubro",
  "Novembro",
  "Dezembro",
];

document.addEventListener("DOMContentLoaded", function () {
  initializeMonthSelector();
  initializeChartSelector();
  loadFinancialData();
  loadChartData("bar");

  if (document.getElementById("prevPage")) {
    document
      .getElementById("prevPage")
      .addEventListener("click", goToPreviousPage);
  }
  if (document.getElementById("nextPage")) {
    document.getElementById("nextPage").addEventListener("click", goToNextPage);
  }

  if (document.getElementById("analyzeVatBtn")) {
    document.getElementById("analyzeVatBtn").addEventListener("click", fetchVatData);
  }

  window.addEventListener("click", function (event) {
    const transactionsModal = document.getElementById("transactionsModal");
    const profitModal = document.getElementById("profitDetailsModal");
    const vatModal = document.getElementById("vatAnalysisModal");
    const employeeModal = document.getElementById("employeeDetailsModal");

    if (event.target === transactionsModal) {
      closeModal();
    }

    if (profitModal && event.target === profitModal) {
      closeProfitModal();
    }
    
    if (vatModal && event.target === vatModal) {
      closeVatModal();
    }
    
    if (employeeModal && event.target === employeeModal) {
      closeEmployeeModal();
    }
  });
});

function initializeMonthSelector() {
  const currentMonthElement = document.getElementById("currentMonth");
  const prevBtn = document.getElementById("prevMonth");
  const nextBtn = document.getElementById("nextMonth");

  updateMonthDisplay();

  prevBtn.addEventListener("click", () => {
    if (currentMonth === 0) {
      currentMonth = 11;
      currentYear--;
    } else {
      currentMonth--;
    }
    updateMonthDisplay();
    loadFinancialData();

    const chartType = document.getElementById("chartType").value;
    loadChartData(chartType);
  });

  nextBtn.addEventListener("click", () => {
    if (currentMonth === 11) {
      currentMonth = 0;
      currentYear++;
    } else {
      currentMonth++;
    }
    updateMonthDisplay();
    loadFinancialData();

    const chartType = document.getElementById("chartType").value;
    loadChartData(chartType);
  });
}

function updateMonthDisplay() {
  const currentMonthElement = document.getElementById("currentMonth");
  currentMonthElement.textContent = `${months[currentMonth]} ${currentYear}`;
}

function loadFinancialData() {
  const company_id = getCompanyId();

  showLoading(true);

  fetch(
    `/api/financial-summary?company_id=${company_id}&month=${
      currentMonth + 1
    }&year=${currentYear}`
  )
    .then((response) => response.json())
    .then((data) => {
      if (data.success) {
        updateFinancialCards(data.summary);
      } else {
        console.error("Erro ao carregar dados:", data.message);
        resetFinancialCards();
      }
    })
    .catch((error) => {
      console.error("Erro na requisição:", error);
      resetFinancialCards();
    })
    .finally(() => {
      showLoading(false);
    });
}

function getCompanyId() {
  const urlParams = new URLSearchParams(window.location.search);
  const pathParts = window.location.pathname.split("/");

  let companyId = urlParams.get("company_id");

  if (!companyId && pathParts.length > 2) {
    companyId = pathParts[pathParts.length - 1];
  }

  return companyId;
}

function showLoading(isLoading) {
  const cards = document.querySelectorAll(".card-value, .card-change");
  if (isLoading) {
    cards.forEach((card) => {
      card.classList.add("loading");
    });
  } else {
    cards.forEach((card) => {
      card.classList.remove("loading");
    });
  }
}

function resetFinancialCards() {
  document.getElementById("revenue-value").textContent = "€0";
  document.getElementById("expenses-value").textContent = "€0";
  document.getElementById("profit-value").textContent = "€0";
  document.getElementById("collaborators-value").textContent = "€0";

  document.getElementById("revenue-change").textContent = "0%";
  document.getElementById("expenses-change").textContent = "0%";
  document.getElementById("profit-change").textContent = "0%";
  document.getElementById("collaborators-change").textContent = "0%";
  document.getElementById("vat-value").textContent = "€0";
  document.getElementById("vat-change").textContent = "0%";

  document.querySelectorAll(".card-change").forEach((el) => {
    el.classList.remove("positive", "negative", "neutral");
  });
}

function updateFinancialCards(data) {
  document.getElementById("revenue-value").textContent = formatCurrency(
    data.total_sales || 0  
  );
  document.getElementById("expenses-value").textContent = formatCurrency(
    data.total_costs_without_vat || 0 
  );
  document.getElementById("profit-value").textContent = formatCurrency(
    data.profit_without_vat || 0
  );
  document.getElementById("collaborators-value").textContent = formatCurrency(
    data.total_employee_salaries || 0
  );
  document.getElementById("vat-value").textContent = formatCurrency(
    data.total_vat || 0
  );

  updateChangeIndicator("revenue-change", data.sales_change);
  updateChangeIndicator("expenses-change", data.costs_change);
  updateChangeIndicator("profit-change", data.profit_change);
  updateChangeIndicator("collaborators-change", data.employee_costs_change);
  updateChangeIndicator("vat-change", data.vat_change);
}

function updateChangeIndicator(elementId, changeValue) {
  const element = document.getElementById(elementId);
  if (!element) return;

  if (changeValue === undefined || changeValue === null) {
    element.textContent = "0%";
    element.className = "card-change neutral";
    return;
  }

  const formattedChange =
    (changeValue > 0 ? "+" : "") + changeValue.toFixed(1) + "%";
  element.textContent = formattedChange;

  element.className = "card-change";
  if (changeValue > 0) {
    element.classList.add("positive");
  } else if (changeValue < 0) {
    element.classList.add("negative");
  } else {
    element.classList.add("neutral");
  }
}

function formatCurrency(value) {
  return (
    "€" +
    Number(value).toLocaleString("pt-PT", {
      minimumFractionDigits: 2,
      maximumFractionDigits: 2,
    })
  );
}

function initializeChartSelector() {
  const chartSelector = document.getElementById("chartType");
  if (chartSelector) {
    chartSelector.addEventListener("change", (e) => {
      loadChartData(e.target.value);
    });
  }
}

function loadChartData(chartType) {
  const company_id = getCompanyId();

  showChartLoading(true);

  fetch(
    `/api/chart-data?company_id=${company_id}&type=${chartType}&month=${
      currentMonth + 1
    }&year=${currentYear}`
  )
    .then((response) => response.json())
    .then((data) => {
      if (data.success) {
        createChart(chartType, data.chartData);
      } else {
        console.error("Erro ao carregar dados do gráfico:", data.message);
        showChartError();
      }
    })
    .catch((error) => {
      console.error("Erro na requisição:", error);
      showChartError();
    })
    .finally(() => {
      showChartLoading(false);
    });
}

function createChart(type, data) {
  const ctx = document.getElementById("mainChart").getContext("2d");

  if (currentChart) {
    currentChart.destroy();
  }

  const config = {
    type: type === "line" ? "line" : type,
    data: data,
    options: {
      responsive: true,
      maintainAspectRatio: false,
      plugins: {
        legend: {
          position: "bottom",
          labels: {
            padding: 20,
            usePointStyle: true,
          },
        },
      },
      scales:
        type !== "pie"
          ? {
              y: {
                beginAtZero: true,
                grid: {
                  color: "#f1f5f9",
                },
                ticks: {
                  callback: function (value) {
                    return "€" + value.toLocaleString();
                  },
                },
              },
              x: {
                grid: {
                  display: false,
                },
              },
            }
          : {},
    },
  };

  if (type === "line") {
    config.options.elements = {
      point: {
        hoverRadius: 8,
      },
    };
  }

  currentChart = new Chart(ctx, config);
}

function showChartLoading(isLoading) {
  const chartContainer = document.querySelector(".chart-container");

  if (isLoading) {
    if (!document.getElementById("chart-loading")) {
      const loadingElement = document.createElement("div");
      loadingElement.id = "chart-loading";
      loadingElement.className = "chart-loading";
      loadingElement.innerHTML = `
                <div class="spinner"></div>
                <p>Carregando dados...</p>
            `;
      chartContainer.appendChild(loadingElement);
    }
  } else {
    const loadingElement = document.getElementById("chart-loading");
    if (loadingElement) {
      loadingElement.remove();
    }
  }
}

function showChartError() {
  const ctx = document.getElementById("mainChart").getContext("2d");

  if (currentChart) {
    currentChart.destroy();
    currentChart = null;
  }

  ctx.clearRect(0, 0, ctx.canvas.width, ctx.canvas.height);

  ctx.font = "16px Arial";
  ctx.textAlign = "center";
  ctx.fillStyle = "#ef4444";
  ctx.fillText(
    "Erro ao carregar dados do gráfico",
    ctx.canvas.width / 2,
    ctx.canvas.height / 2
  );
}

function openTransactionsModal(transactionType, title) {
  currentTransactionType = transactionType;
  currentPage = 1;

  document.getElementById("modalTitle").textContent = title;

  const modal = document.getElementById("transactionsModal");
  modal.style.display = "block";

  loadTransactions(transactionType);

  document.body.style.overflow = "hidden";
}

function closeModal() {
  const modal = document.getElementById("transactionsModal");
  modal.style.display = "none";

  document.body.style.overflow = "auto";
}

function loadTransactions(transactionType) {
  const company_id = getCompanyId();

  document.getElementById("loadingIndicator").style.display = "flex";
  document.getElementById("noTransactionsMessage").style.display = "none";
  document.getElementById("transactionsTableBody").innerHTML = "";
  document.getElementById("paginationContainer").style.display = "none";

  fetch(
    `/api/transactions?company_id=${company_id}&month=${
      currentMonth + 1
    }&year=${currentYear}&type=${transactionType}`
  )
    .then((response) => response.json())
    .then((data) => {
      if (data.success && data.transactions && data.transactions.length > 0) {
        allTransactions = data.transactions;

        totalPages = Math.ceil(allTransactions.length / transactionsPerPage);

        renderTransactionsTable();
        renderPagination();

        document.getElementById("paginationContainer").style.display = "flex";
      } else {
        document.getElementById("noTransactionsMessage").style.display =
          "block";
      }
    })
    .catch((error) => {
      console.error("Erro ao carregar transações:", error);
      document.getElementById("noTransactionsMessage").textContent =
        "Erro ao carregar transações. Tente novamente.";
      document.getElementById("noTransactionsMessage").style.display = "block";
    })
    .finally(() => {
      document.getElementById("loadingIndicator").style.display = "none";
    });
}

function renderTransactionsTable() {
  const tableBody = document.getElementById("transactionsTableBody");
  tableBody.innerHTML = "";

  const startIndex = (currentPage - 1) * transactionsPerPage;
  const endIndex = Math.min(
    startIndex + transactionsPerPage,
    allTransactions.length
  );

  const transactionsForPage = allTransactions.slice(startIndex, endIndex);

  transactionsForPage.forEach((transaction) => {
    const row = document.createElement("tr");
    row.className =
      transaction.transaction_type.toLowerCase() === "ganho"
        ? "ganho-row"
        : "despesa-row";

    row.innerHTML = `
            <td>
                <span class="table-badge ${
                  transaction.transaction_type.toLowerCase() === "ganho"
                    ? "badge-ganho"
                    : "badge-despesa"
                }">
                    ${transaction.transaction_type}
                </span>
            </td>
            <td>${transaction.description}</td>
            <td>${formatCurrency(transaction.gross_value)}</td>
            <td>${transaction.iva_rate}%</td>
            <td>${formatCurrency(transaction.iva_value)}</td>
            <td>${formatCurrency(transaction.net_value)}</td>
        `;

    tableBody.appendChild(row);
  });
}

function renderPagination() {
  const pageNumbers = document.getElementById("pageNumbers");
  pageNumbers.innerHTML = "";

  document.getElementById("prevPage").disabled = currentPage === 1;
  document.getElementById("nextPage").disabled = currentPage === totalPages;

  if (totalPages <= 7) {
    for (let i = 1; i <= totalPages; i++) {
      pageNumbers.appendChild(createPageNumberButton(i));
    }
    return;
  }

  if (currentPage <= 3) {
    for (let i = 1; i <= 5; i++) {
      pageNumbers.appendChild(createPageNumberButton(i));
    }
    pageNumbers.appendChild(createEllipsis());
    pageNumbers.appendChild(createPageNumberButton(totalPages));
  } else if (currentPage >= totalPages - 2) {
    pageNumbers.appendChild(createPageNumberButton(1));
    pageNumbers.appendChild(createEllipsis());
    for (let i = totalPages - 4; i <= totalPages; i++) {
      pageNumbers.appendChild(createPageNumberButton(i));
    }
  } else {
    pageNumbers.appendChild(createPageNumberButton(1));
    pageNumbers.appendChild(createEllipsis());
    for (let i = currentPage - 1; i <= currentPage + 1; i++) {
      pageNumbers.appendChild(createPageNumberButton(i));
    }
    pageNumbers.appendChild(createEllipsis());
    pageNumbers.appendChild(createPageNumberButton(totalPages));
  }
}

function createPageNumberButton(pageNum) {
  const button = document.createElement("button");
  button.className = "page-number";
  button.textContent = pageNum;

  if (pageNum === currentPage) {
    button.classList.add("active");
  }

  button.addEventListener("click", () => {
    currentPage = pageNum;
    renderTransactionsTable();
    renderPagination();
  });

  return button;
}

function createEllipsis() {
  const span = document.createElement("span");
  span.className = "page-ellipsis";
  span.textContent = "...";
  return span;
}

function goToPreviousPage() {
  if (currentPage > 1) {
    currentPage--;
    renderTransactionsTable();
    renderPagination();
  }
}

function goToNextPage() {
  if (currentPage < totalPages) {
    currentPage++;
    renderTransactionsTable();
    renderPagination();
  }
}

function editTransaction(id) {
  const company_id = getCompanyId();
  window.location.href = `/expenses/${company_id}?edit=${id}`;
}

function deleteTransaction(id) {
  if (confirm("Tem certeza que deseja excluir esta transação?")) {
    fetch(`/delete-expense/${id}`, {
      method: "POST",
    })
      .then((response) => response.json())
      .then((data) => {
        if (data.success) {
          loadTransactions(currentTransactionType);
          loadFinancialData();
          loadChartData(document.getElementById("chartType").value);
        } else {
          alert(`Erro ao excluir: ${data.message}`);
        }
      })
      .catch((error) => {
        console.error("Erro ao excluir transação:", error);
        alert("Erro ao excluir transação. Tente novamente.");
      });
  }
}

function openProfitDetailsModal() {
  const modal = document.getElementById("profitDetailsModal");
  modal.style.display = "block";

  document.body.style.overflow = "hidden";

  loadProfitDetails();
}

function closeProfitModal() {
  const modal = document.getElementById("profitDetailsModal");
  modal.style.display = "none";

  document.body.style.overflow = "auto";

  if (profitChart) {
    profitChart.destroy();
    profitChart = null;
  }
}

async function loadProfitDetails() {
  const company_id = getCompanyId();

  try {
    const financialResponse = await fetch(
      `/api/financial-summary?company_id=${company_id}&month=${
        currentMonth + 1
      }&year=${currentYear}`
    );
    const financialData = await financialResponse.json();

    const settingsResponse = await fetch(`/get-settings/${company_id}`);
    const settingsData = await settingsResponse.json();

    if (financialData.success) {
      const summary = financialData.summary;
      const settings = settingsData.success
        ? settingsData.settings
        : {
            rent_value: 0,
            total_insurance_value: 0,
            employee_insurance_value: 0,
          };

      const totalRevenue = summary.total_sales_without_vat || 0;
      
      const insuranceExpenses = (settings.total_insurance_value || 0) + (settings.employee_insurance_value || 0);
      
      const operationalExpenses =
        (summary.total_costs_without_vat || 0) -
        (summary.total_employee_salaries || 0) -
        (settings.rent_value || 0) -
        insuranceExpenses;
        
      const employeeExpenses = summary.total_employee_salaries || 0;
      const rentExpenses = settings.rent_value || 0;

      const totalExpenses =
        operationalExpenses +
        employeeExpenses +
        insuranceExpenses +
        rentExpenses;
      
      const profit = totalRevenue - totalExpenses;

      document.getElementById("modal-total-revenue").textContent =
        formatCurrency(totalRevenue);
      document.getElementById(
        "modal-total-expenses"
      ).textContent = `-${formatCurrency(totalExpenses)}`;
      document.getElementById("modal-total-profit").textContent =
        formatCurrency(profit);

      document.getElementById("modal-gross-sales").textContent = formatCurrency(
        summary.total_sales || 0
      );
      document.getElementById("modal-total-vat").textContent = formatCurrency(
        summary.total_vat || 0
      );
      document.getElementById("modal-net-sales").textContent =
        formatCurrency(totalRevenue);

      document.getElementById("modal-operational-expenses").textContent =
        formatCurrency(operationalExpenses);
      document.getElementById("modal-employee-expenses").textContent =
        formatCurrency(employeeExpenses);
      document.getElementById("modal-insurance-expenses").textContent =
        formatCurrency(insuranceExpenses);
      document.getElementById("modal-rent-expenses").textContent =
        formatCurrency(rentExpenses);
      document.getElementById("modal-expenses-total").textContent =
        formatCurrency(totalExpenses);

      createProfitComparisonChart(totalRevenue, totalExpenses, profit);
    }
  } catch (error) {
    console.error("Erro ao carregar detalhes do lucro:", error);
  }
}

function createProfitComparisonChart(revenue, expenses, profit) {
  const ctx = document.getElementById("profitComparisonChart").getContext("2d");

  if (profitChart) {
    profitChart.destroy();
  }

  const profitColor = profit >= 0 ? "#16a34a" : "#dc2626";

  const data = {
    labels: ["Receitas", "Despesas", "Lucro"],
    datasets: [
      {
        data: [revenue, expenses, Math.abs(profit)],
        backgroundColor: ["#22c55e", "#f59e0b", profitColor],
        borderRadius: 6,
        borderWidth: 0,
      },
    ],
  };

  const config = {
    type: "bar",
    data: data,
    options: {
      responsive: true,
      maintainAspectRatio: false,
      plugins: {
        legend: {
          display: false,
        },
        tooltip: {
          callbacks: {
            label: function (context) {
              let label = context.dataset.label || "";
              if (label) {
                label += ": ";
              }
              label += formatCurrency(context.raw);
              return label;
            },
          },
        },
      },
      scales: {
        y: {
          beginAtZero: true,
          grid: {
            display: true,
            color: "#f1f5f9",
          },
          ticks: {
            callback: function (value) {
              return "€" + value.toLocaleString();
            },
          },
        },
        x: {
          grid: {
            display: false,
          },
        },
      },
    },
  };

  profitChart = new Chart(ctx, config);
}

// Função para abrir o modal de detalhes de funcionários
function openEmployeeDetailsModal() {
  const modal = document.getElementById("employeeDetailsModal");
  modal.style.display = "block";
  document.body.style.overflow = "hidden";
  
  fetchEmployeeData();
}

// Função para fechar o modal de funcionários
function closeEmployeeModal() {
  const modal = document.getElementById("employeeDetailsModal");
  modal.style.display = "none";
  document.body.style.overflow = "auto";
  
  if (employeeChart) {
    employeeChart.destroy();
    employeeChart = null;
  }
}

// Função para buscar os dados dos funcionários
function fetchEmployeeData() {
  const company_id = getCompanyId();
  
  document.getElementById("employeeLoadingIndicator").style.display = "flex";
  document.getElementById("employeeTableBody").innerHTML = "";
  document.getElementById("noEmployeesMessage").style.display = "none";
  
  fetch(`/get-employees/${company_id}`)
    .then(response => response.json())
    .then(data => {
      if (data.success && data.employees && data.employees.length > 0) {
        employeeData = data.employees.filter(emp => emp.is_active);
        renderEmployeeTable();
        createEmployeeChart();
      } else {
        document.getElementById("noEmployeesMessage").style.display = "block";
      }
    })
    .catch(error => {
      console.error("Erro ao carregar dados dos colaboradores:", error);
      document.getElementById("noEmployeesMessage").textContent = 
        "Erro ao carregar dados dos colaboradores. Tente novamente.";
      document.getElementById("noEmployeesMessage").style.display = "block";
    })
    .finally(() => {
      document.getElementById("employeeLoadingIndicator").style.display = "none";
    });
}

// Função para renderizar a tabela de funcionários - CORRIGIDA
function renderEmployeeTable() {
  const tableBody = document.getElementById("employeeTableBody");
  tableBody.innerHTML = "";
  
  let totalGrossSalary = 0;
  let totalEmployeeSS = 0;
  let totalEmployerSS = 0;
  let totalIRS = 0;
  let totalNetSalary = 0;
  
  employeeData.forEach(employee => {
    const row = document.createElement("tr");
    
    // O valor em employee.gross_salary é o custo total para a empresa
    const totalCost = employee.gross_salary;
    
    // Calcular o salário bruto real
    const grossSalary = totalCost / (1 + employee.employer_social_security_rate / 100);
    
    // Calcular valores baseados no salário bruto real
    const employeeSS = (grossSalary * employee.social_security_rate) / 100;
    const employerSS = (grossSalary * employee.employer_social_security_rate) / 100;
    const irs = (grossSalary * employee.irs_rate) / 100;
    const netSalary = grossSalary - employeeSS - irs;
    
    row.innerHTML = `
      <td>${employee.name}</td>
      <td>${employee.position}</td>
      <td>${formatCurrency(grossSalary)}</td>
      <td>${formatCurrency(employeeSS)}</td>
      <td>${formatCurrency(employerSS)}</td>
      <td>${formatCurrency(irs)}</td>
      <td>${formatCurrency(netSalary)}</td>
    `;
    
    tableBody.appendChild(row);
    
    // Acumular totais
    totalGrossSalary += grossSalary;
    totalEmployeeSS += employeeSS;
    totalEmployerSS += employerSS;
    totalIRS += irs;
    totalNetSalary += netSalary;
  });
  
  // Atualizar os totais no rodapé da tabela
  document.getElementById("totalGrossSalary").textContent = formatCurrency(totalGrossSalary);
  document.getElementById("totalEmployeeSS").textContent = formatCurrency(totalEmployeeSS);
  document.getElementById("totalEmployerSS").textContent = formatCurrency(totalEmployerSS);
  document.getElementById("totalIRS").textContent = formatCurrency(totalIRS);
  document.getElementById("totalNetSalary").textContent = formatCurrency(totalNetSalary);
}

// Função para criar o gráfico de comparação entre funcionários - CORRIGIDA
function createEmployeeChart() {
  const ctx = document.getElementById("employeeComparisonChart").getContext("2d");
  
  if (employeeChart) {
    employeeChart.destroy();
  }
  
  // Preparar os dados para o gráfico com os cálculos corretos
  const labels = employeeData.map(emp => emp.name);
  const grossSalaries = employeeData.map(emp => {
    return emp.gross_salary / (1 + emp.employer_social_security_rate / 100);
  });
  
  const employeeSS = employeeData.map((emp, index) => {
    return (grossSalaries[index] * emp.social_security_rate) / 100;
  });
  
  const employerSS = employeeData.map((emp, index) => {
    return (grossSalaries[index] * emp.employer_social_security_rate) / 100;
  });
  
  const irs = employeeData.map((emp, index) => {
    return (grossSalaries[index] * emp.irs_rate) / 100;
  });
  
  employeeChart = new Chart(ctx, {
    type: 'bar',
    data: {
      labels: labels,
      datasets: [
        {
          label: 'Salário Bruto',
          data: grossSalaries,
          backgroundColor: '#22c55e',
          borderWidth: 0,
          borderRadius: 4
        },
        {
          label: 'SS Empregado',
          data: employeeSS,
          backgroundColor: '#f59e0b',
          borderWidth: 0,
          borderRadius: 4
        },
        {
          label: 'SS Empregador',
          data: employerSS,
          backgroundColor: '#8b5cf6',
          borderWidth: 0,
          borderRadius: 4
        },
        {
          label: 'IRS',
          data: irs,
          backgroundColor: '#ef4444',
          borderWidth: 0,
          borderRadius: 4
        }
      ]
    },
    options: {
      responsive: true,
      maintainAspectRatio: false,
      plugins: {
        legend: {
          position: 'bottom',
          labels: {
            padding: 20,
            usePointStyle: true
          }
        },
        tooltip: {
          callbacks: {
            label: function(context) {
              let label = context.dataset.label || '';
              if (label) {
                label += ': ';
              }
              label += formatCurrency(context.raw);
              return label;
            }
          }
        }
      },
      scales: {
        y: {
          beginAtZero: true,
          grid: {
            color: '#f1f5f9',
          },
          ticks: {
            callback: function(value) {
              return '€' + value.toLocaleString();
            }
          }
        },
        x: {
          grid: {
            display: false
          }
        }
      }
    }
  });
}

function openVatAnalysisModal() {
  const modal = document.getElementById("vatAnalysisModal");
  modal.style.display = "block";
  document.body.style.overflow = "hidden";
  
  // Limpar seleções anteriores
  selectedMonths = [];
  
  // Preparar os meses disponíveis para seleção
  generateAvailableMonths();
  
  // Renderizar os checkboxes de seleção de meses
  renderMonthCheckboxes();
  
  // Resetar a interface para a seleção de meses
  showMonthSelector();
}

function closeVatModal() {
  const modal = document.getElementById("vatAnalysisModal");
  modal.style.display = "none";
  document.body.style.overflow = "auto";
  
  // Destruir o gráfico ao fechar o modal para liberar memória
  if (vatAnalysisChart) {
    vatAnalysisChart.destroy();
    vatAnalysisChart = null;
  }
}

function generateAvailableMonths() {
  availableMonths = [];
  
  // Mês atual
  const currentDate = new Date();
  let year = currentDate.getFullYear();
  let month = currentDate.getMonth(); // 0-11
  
  // Gerar 24 meses (2 anos) para trás
  for (let i = 0; i < 24; i++) {
    availableMonths.push({
      month: month + 1, // Converter para 1-12
      year: year,
      label: `${months[month]} ${year}`,
      selected: false
    });
    
    // Mover para o mês anterior
    if (month === 0) {
      month = 11;
      year--;
    } else {
      month--;
    }
  }
}

function renderMonthCheckboxes() {
  const container = document.getElementById("monthCheckboxes");
  container.innerHTML = "";
  
  availableMonths.forEach((monthData, index) => {
    const checkboxItem = document.createElement("div");
    checkboxItem.className = `month-checkbox-item ${monthData.selected ? 'selected' : ''}`;
    checkboxItem.setAttribute("data-index", index);
    
    checkboxItem.innerHTML = `
      <input type="checkbox" id="month-${index}" ${monthData.selected ? 'checked' : ''}>
      <label for="month-${index}">${monthData.label}</label>
    `;
    
    checkboxItem.addEventListener("click", () => toggleMonthSelection(index));
    container.appendChild(checkboxItem);
  });
  
  updateSelectedCount();
}

function toggleMonthSelection(index) {
  // Toggle a seleção
  availableMonths[index].selected = !availableMonths[index].selected;
  
  // Atualizar a lista de meses selecionados
  selectedMonths = availableMonths.filter(month => month.selected);
  
  // Atualizar a UI
  const checkboxItem = document.querySelector(`.month-checkbox-item[data-index="${index}"]`);
  const checkbox = checkboxItem.querySelector('input[type="checkbox"]');
  
  if (availableMonths[index].selected) {
    checkboxItem.classList.add("selected");
    checkbox.checked = true;
  } else {
    checkboxItem.classList.remove("selected");
    checkbox.checked = false;
  }
  
  updateSelectedCount();
}

function updateSelectedCount() {
  const countElement = document.getElementById("selectedCount");
  const analyzeBtn = document.getElementById("analyzeVatBtn");
  const count = selectedMonths.length;
  
  countElement.textContent = `${count} meses selecionados`;
  
  // Habilitar o botão apenas se o número de meses selecionados estiver entre 3 e 12
  if (count >= 3 && count <= 12) {
    analyzeBtn.disabled = false;
  } else {
    analyzeBtn.disabled = true;
  }
}

function showMonthSelector() {
  document.getElementById("vatResultsSection").style.display = "none";
  document.querySelector(".month-selector-section").style.display = "block";
}

function fetchVatData() {
  if (selectedMonths.length < 3 || selectedMonths.length > 12) {
    return;
  }
  
  // Mostrar indicador de carregamento
  document.getElementById("vatLoadingIndicator").style.display = "flex";
  document.querySelector(".month-selector-section").style.display = "none";
  
  const company_id = getCompanyId();
  vatMonthlyData = [];
  
  // CORREÇÃO AQUI: Usar financial-summary em vez de simple-financial-summary
  const fetchPromises = selectedMonths.map(monthData => {
    return fetch(`/api/financial-summary?company_id=${company_id}&month=${monthData.month}&year=${monthData.year}`)
      .then(response => response.json())
      .then(data => {
        if (data.success) {
          return {
            month: monthData.month,
            year: monthData.year,
            label: monthData.label,
            total_vat: data.summary.total_vat || 0,
            total_sales: data.summary.total_sales || 0
          };
        }
        return null;
      })
      .catch(error => {
        console.error(`Erro ao buscar dados para ${monthData.label}:`, error);
        return null;
      });
  });
  
  // Processar todas as promessas
  Promise.all(fetchPromises)
    .then(results => {
      // Filtrar resultados nulos
      vatMonthlyData = results.filter(data => data !== null);
      
      // Verificar se temos pelo menos um resultado válido
      if (vatMonthlyData.length === 0) {
        alert("Não foram encontrados dados para os meses selecionados.");
        document.getElementById("vatLoadingIndicator").style.display = "none";
        document.querySelector(".month-selector-section").style.display = "block";
        return;
      }
      
      // Ordenar por data (do mais recente para o mais antigo)
      vatMonthlyData.sort((a, b) => {
        if (a.year !== b.year) return b.year - a.year;
        return b.month - a.month;
      });
      
      // Mostrar os resultados
      renderVatResults();
    })
    .catch(error => {
      console.error("Erro ao buscar dados de IVA:", error);
      alert("Ocorreu um erro ao buscar os dados de IVA. Por favor, tente novamente.");
      document.getElementById("vatLoadingIndicator").style.display = "none";
      document.querySelector(".month-selector-section").style.display = "block";
    })
    .finally(() => {
      document.getElementById("vatLoadingIndicator").style.display = "none";
    });
}

function renderVatResults() {
  document.getElementById("vatResultsSection").style.display = "block";
  
  const tableBody = document.getElementById("vatResultsTableBody");
  tableBody.innerHTML = "";
  
  let totalVat = 0;
  let totalSales = 0;
  
  vatMonthlyData.forEach(data => {
    const row = document.createElement("tr");
    
    row.innerHTML = `
      <td class="month-name">${data.label}</td>
      <td>${formatCurrency(data.total_vat)}</td>
      <td>${formatCurrency(data.total_sales)}</td>
    `;
    
    tableBody.appendChild(row);
    
    totalVat += data.total_vat;
    totalSales += data.total_sales;
  });
  
  document.getElementById("totalVatValue").textContent = formatCurrency(totalVat);
  document.getElementById("totalSalesValue").textContent = formatCurrency(totalSales);

  createVatAnalysisChart();
}

function createVatAnalysisChart() {
  const ctx = document.getElementById("vatAnalysisChart").getContext("2d");
  
  if (vatAnalysisChart) {
    vatAnalysisChart.destroy();
  }
  
  // Inverter a ordem para que os meses fiquem do mais antigo para o mais recente no gráfico
  const chartData = [...vatMonthlyData].reverse();
  
  vatAnalysisChart = new Chart(ctx, {
    type: 'bar',
    data: {
      labels: chartData.map(data => data.label),
      datasets: [
        {
          label: 'Valor de IVA',
          data: chartData.map(data => data.total_vat),
          backgroundColor: '#8b5cf6',
          borderWidth: 0,
          borderRadius: 4
        },
        {
          label: 'Vendas Totais',
          data: chartData.map(data => data.total_sales),
          backgroundColor: '#22c55e',
          borderWidth: 0,
          borderRadius: 4
        }
      ]
    },
    options: {
      responsive: true,
      maintainAspectRatio: false,
      plugins: {
        legend: {
          position: 'bottom',
          labels: {
            padding: 20,
            usePointStyle: true
          }
        },
        tooltip: {
          callbacks: {
            label: function(context) {
              let label = context.dataset.label || '';
              if (label) {
                label += ': ';
              }
              label += formatCurrency(context.raw);
              return label;
            }
          }
        }
      },
      scales: {
        y: {
          beginAtZero: true,
          grid: {
            color: '#f1f5f9',
          },
          ticks: {
            callback: function(value) {
              return '€' + value.toLocaleString();
            }
          }
        },
        x: {
          grid: {
            display: false
          }
        }
      }
    }
  });
}

document.querySelectorAll(".summary-card").forEach((card) => {
  card.addEventListener("mouseenter", function () {
    this.style.transform = "translateY(-4px)";
    this.style.boxShadow = "0 10px 25px rgba(0, 0, 0, 0.15)";
  });

  card.addEventListener("mouseleave", function () {
    if (this.classList.contains("clickable")) {
      this.style.transform = "translateY(0)";
    } else {
      this.style.transform = "translateY(0)";
    }
    this.style.boxShadow = "0 1px 3px rgba(0, 0, 0, 0.1)";
  });
});

function goBack() {
  const pathParts = window.location.pathname.split("/");
  const company_id = pathParts[pathParts.length - 1];
  window.location.href = `/main-menu/${company_id}`;
}

function handleLogout() {
  window.location.href = "/logout";
}