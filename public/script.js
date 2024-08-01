window.addEventListener('load', () => {
    const welcomer_title = document.querySelector('.title');
    const welcomer_text = document.querySelector('.text-header');

    setTimeout(() => {
        welcomer_title.classList.remove('hidden-above');
    }, 200);

    setTimeout(() => {
        welcomer_text.classList.remove('hidden-below');
    }, 1000);
});