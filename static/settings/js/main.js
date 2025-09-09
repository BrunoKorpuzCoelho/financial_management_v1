function getCompanyId() {
  const pathParts = window.location.pathname.split("/");
  for (let i = 0; i < pathParts.length; i++) {
    if (pathParts[i] === "settings" && i + 1 < pathParts.length) {
      return pathParts[i + 1];
    }
  }
  return null;
}

function populateDayOptions() {
  const daySelect = document.getElementById("preferredSalaryExpenseDay");

  if (!daySelect) return;

  const currentValue = daySelect.value;

  daySelect.innerHTML = "";

  for (let i = 1; i <= 28; i++) {
    const option = document.createElement("option");
    option.value = i;
    option.textContent = `Dia ${i}`;
    daySelect.appendChild(option);
  }

  const lastDayOption = document.createElement("option");
  lastDayOption.value = 99;
  lastDayOption.textContent = "Último dia do mês";
  daySelect.appendChild(lastDayOption);

  if (currentValue) {
    daySelect.value = currentValue;
  } else {
    daySelect.value = 1;
  }
}

async function loadSettings() {
  const companyId = getCompanyId();
  if (!companyId) {
    showToast("Erro: ID da empresa não encontrado na URL.", "error");
    return;
  }

  try {
    const response = await fetch(`/get-settings/${companyId}`);
    const data = await response.json();

    if (data.success) {
      const settings = data.settings;

      document.getElementById("totalInsuranceValue").value =
        settings.total_insurance_value || 0.0;
      document.getElementById("rentValue").value = settings.rent_value || 0.0;
      document.getElementById("employeeInsuranceValue").value =
        settings.employee_insurance_value || 0.0;

      const daySelect = document.getElementById("preferredSalaryExpenseDay");
      const preferredDay = settings.preferred_salary_expense_day || 1;

      if (preferredDay === 99 || preferredDay > 28) {
        daySelect.value = 99;
      } else {
        daySelect.value = preferredDay;
      }

      document.getElementById("companyIdInput").value = companyId;
    } else {
      document.getElementById("companyIdInput").value = companyId;
    }
  } catch (error) {
    showToast(`Erro ao carregar configurações: ${error.message}`, "error");
  }
}

async function saveSettings(event) {
  event.preventDefault();

  try {
    const formData = new FormData(document.getElementById("settingsForm"));

    const response = await fetch("/save-settings", {
      method: "POST",
      body: formData,
    });

    const result = await response.json();

    if (result.success) {
      showToast(result.message || "Configurações guardadas com sucesso!");
    } else {
      showToast(result.message || "Erro ao guardar configurações.", "error");
    }
  } catch (error) {
    showToast("Erro ao processar a solicitação: " + error.message, "error");
  }
}

function showToast(message, type = "success") {
  const toast = document.getElementById("toast");
  const toastMessage = document.getElementById("toastMessage");

  const iconContainer = toast.querySelector(".toast-icon");

  const icons = {
    success:
      '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="#10b981" width="24" height="24"><path fill-rule="evenodd" d="M2.25 12c0-5.385 4.365-9.75 9.75-9.75s9.75 4.365 9.75 9.75-4.365 9.75-9.75 9.75S2.25 17.385 2.25 12zm13.36-1.814a.75.75 0 10-1.22-.872l-3.236 4.53L9.53 12.22a.75.75 0 00-1.06 1.06l2.25 2.25a.75.75 0 001.14-.094l3.75-5.25z" clip-rule="evenodd" /></svg>',
    error:
      '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="#ef4444" width="24" height="24"><path fill-rule="evenodd" d="M12 2.25c-5.385 0-9.75 4.365-9.75 9.75s4.365 9.75 9.75 9.75 9.75-4.365 9.75-9.75S17.385 2.25 12 2.25zm-1.72 6.97a.75.75 0 10-1.06 1.06L10.94 12l-1.72 1.72a.75.75 0 101.06 1.06L12 13.06l1.72 1.72a.75.75 0 101.06-1.06L13.06 12l1.72-1.72a.75.75 0 10-1.06-1.06L12 10.94l-1.72-1.72z" clip-rule="evenodd" /></svg>',
    warning:
      '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="#f59e0b" width="24" height="24"><path fill-rule="evenodd" d="M9.401 3.003c1.155-2 4.043-2 5.197 0l7.355 12.748c1.154 2-.29 4.5-2.599 4.5H4.645c-2.309 0-3.752-2.5-2.598-4.5L9.4 3.003zM12 8.25a.75.75 0 01.75.75v3.75a.75.75 0 01-1.5 0V9a.75.75 0 01.75-.75zm0 8.25a.75.75 0 100-1.5.75.75 0 000 1.5z" clip-rule="evenodd" /></svg>',
  };

  iconContainer.innerHTML = icons[type] || icons.success;

  toast.classList.remove(
    "toast-success",
    "toast-error",
    "toast-warning",
    "toast-info"
  );

  toast.classList.add(`toast-${type}`);

  toastMessage.textContent = message;

  toast.classList.remove("toast-exit");

  toast.style.display = "flex";

  setTimeout(hideToast, 3000);
}

function hideToast() {
  const toast = document.getElementById("toast");
  toast.classList.add("toast-exit");

  setTimeout(() => {
    toast.style.display = "none";
    toast.classList.remove("toast-exit");
  }, 300);
}

function goBack() {
  const pathParts = window.location.pathname.split("/");
  const company_id = pathParts[pathParts.length - 1];
  window.location.href = `/main-menu/${company_id}`;
}

function handleLogout() {
  window.location.href = "/logout";
}

function openInfoModal() {
  fetchInfoSettings();

  const modal = document.getElementById("infoModal");
  modal.style.display = "block";
  document.body.style.overflow = "hidden";
}

function closeInfoModal() {
  const modal = document.getElementById("infoModal");
  modal.style.display = "none";
  document.body.style.overflow = "auto";
}

async function fetchInfoSettings() {
  try {
    const response = await fetch("/get-info-settings");
    const data = await response.json();

    if (data.success) {
      const info = data.info;

      if (info.payment_vps_date) {
        document.getElementById("paymentDate").value = info.payment_vps_date;
      }

      if (info.subscription_type_vps) {
        document.getElementById("subscriptionType").value =
          info.subscription_type_vps;
      }
    } else {
      showToast(data.message || "Erro ao carregar configurações.", "error");
    }
  } catch (error) {
    showToast("Erro ao processar a solicitação: " + error.message, "error");
  }
}

async function saveInfoSettings() {
  try {
    const paymentDate = document.getElementById("paymentDate").value;
    const subscriptionType = document.getElementById("subscriptionType").value;

    const formData = new FormData();
    formData.append("payment_vps_date", paymentDate);
    formData.append("subscription_type_vps", subscriptionType);

    const response = await fetch("/save-info-settings", {
      method: "POST",
      body: formData,
    });

    const result = await response.json();

    if (result.success) {
      showToast(result.message || "Configurações guardadas com sucesso!");
      closeInfoModal();
    } else {
      showToast(result.message || "Erro ao guardar configurações.", "error");
    }
  } catch (error) {
    showToast("Erro ao processar a solicitação: " + error.message, "error");
  }
}

document.addEventListener("DOMContentLoaded", () => {
  populateDayOptions();

  loadSettings();

  const settingsForm = document.getElementById("settingsForm");
  if (settingsForm) {
    settingsForm.addEventListener("submit", saveSettings);
  }
});
