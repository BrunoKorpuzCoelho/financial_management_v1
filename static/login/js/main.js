document.addEventListener("DOMContentLoaded", () => {
  const inputs = document.querySelectorAll("input")
  inputs.forEach((input) => {
    input.addEventListener("focus", () => {
      if (window.innerWidth < 768) {
        document
          .querySelector("meta[name=viewport]")
          .setAttribute("content", "width=device-width, initial-scale=1.0, maximum-scale=1.0, user-scalable=no")
      }
    })

    input.addEventListener("blur", () => {
      document.querySelector("meta[name=viewport]").setAttribute("content", "width=device-width, initial-scale=1.0")
    })
  })
  
  const flashMessages = document.querySelectorAll('.flash');
  flashMessages.forEach(message => {
    setTimeout(() => {
      message.style.opacity = '0';
      message.style.transition = 'opacity 0.5s ease';
      setTimeout(() => {
        message.style.display = 'none';
      }, 500);
    }, 5000);
  });
})