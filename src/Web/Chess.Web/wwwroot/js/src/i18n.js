function format(value, params = {}) {
    return value.replace(/\{(\w+)\}/g, (_, key) => {
        if (Object.prototype.hasOwnProperty.call(params, key)) {
            return params[key];
        }

        return `{${key}}`;
    });
}

export function t(key, params = {}) {
    const dictionary = window.chessI18n || {};
    const value = dictionary[key] || key;
    return format(value, params);
}
