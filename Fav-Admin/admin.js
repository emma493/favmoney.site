// Fav-Admin shell (no login): visiting the page opens the dashboard directly.
document.body.classList.add('authed');
document.title = 'Fav-Admin · Overview';
if (window.FavLoader) FavLoader.pageReady();
