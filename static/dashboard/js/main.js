function handleCardClick(cardType) {
    console.log(`Clicked on: ${cardType} for company: ${companyId}`);
    
    if (cardType === 'adicionar-transacao') {
        window.location.href = `/expenses/${companyId}`;
    } else if (cardType === 'configurar-orcamento') {
        window.location.href = `/employee/${companyId}`;
    } else if (cardType === 'despesas-mensais') {
        window.location.href = `/dashboard/${companyId}`;  
    } else if (cardType === 'historico-transacoes') {
        window.location.href = `/simple-sales/${companyId}`;  
    }else {
        alert(`Funcionalidade "${cardType}" será implementada em breve!`);
    }
}

function handleLogout() {
    window.location.href = '/logout';
}

document.querySelectorAll('.card').forEach(card => {
    card.addEventListener('touchstart', function() {
        this.style.transform = 'scale(0.95)';
    });
    
    card.addEventListener('touchend', function() {
        setTimeout(() => {
            this.style.transform = 'scale(1)';
        }, 100);
    });
});

function goBack() {
    window.location.href = '/company';
}

function handleSettings() {
  const pathParts = window.location.pathname.split('/');
  const company_id = pathParts[pathParts.length - 1];
  window.location.href = `/settings/${company_id}`;
}