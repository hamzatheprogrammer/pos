const nativeFetch = window.fetch.bind(window);

window.fetch = (input, init = {}) => nativeFetch(input, {
    ...init,
    credentials: init.credentials || 'same-origin'
});
