"use strict";
var __rest = (this && this.__rest) || function (s, e) {
    var t = {};
    for (var p in s) if (Object.prototype.hasOwnProperty.call(s, p) && e.indexOf(p) < 0)
        t[p] = s[p];
    if (s != null && typeof Object.getOwnPropertySymbols === "function")
        for (var i = 0, p = Object.getOwnPropertySymbols(s); i < p.length; i++) {
            if (e.indexOf(p[i]) < 0 && Object.prototype.propertyIsEnumerable.call(s, p[i]))
                t[p[i]] = s[p[i]];
        }
    return t;
};
exports.__esModule = true;
exports.Button = void 0;
var react_1 = require("react");
var baseStyles = 'inline-flex items-center justify-center font-semibold rounded-xl shadow-md transition-all duration-200 focus:outline-none focus:ring-2 focus:ring-offset-2 disabled:opacity-50 disabled:cursor-not-allowed';
var sizeStyles = {
    sm: 'text-sm px-3 py-1.5',
    md: 'text-base px-5 py-2.5',
    lg: 'text-lg px-7 py-3'
};
var variantStyles = {
    primary: 'bg-blue-600 hover:bg-blue-700 text-white focus:ring-blue-400',
    secondary: 'bg-gray-600 hover:bg-gray-700 text-white focus:ring-gray-400',
    success: 'bg-emerald-600 hover:bg-emerald-700 text-white focus:ring-emerald-400',
    danger: 'bg-red-600 hover:bg-red-700 text-white focus:ring-red-400',
    gradient: 'bg-gradient-to-r from-purple-500 to-indigo-600 hover:from-purple-600 hover:to-indigo-700 text-white focus:ring-indigo-400'
};
var Button = function (_a) {
    var children = _a.children, _b = _a.variant, variant = _b === void 0 ? 'primary' : _b, _c = _a.size, size = _c === void 0 ? 'md' : _c, icon = _a.icon, _d = _a.loading, loading = _d === void 0 ? false : _d, _e = _a.fullWidth, fullWidth = _e === void 0 ? false : _e, _f = _a.className, className = _f === void 0 ? '' : _f, props = __rest(_a, ["children", "variant", "size", "icon", "loading", "fullWidth", "className"]);
    return (<button className={[
            baseStyles,
            sizeStyles[size],
            variantStyles[variant],
            fullWidth ? 'w-full' : '',
            className,
        ].join(' ')} disabled={loading || props.disabled} {...props}>
      {loading ? (<svg className="animate-spin h-5 w-5 mr-2 text-white" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
          <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"/>
          <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8v4a4 4 0 00-4 4H4z"/>
        </svg>) : icon ? (<span className="mr-2 flex items-center">{icon}</span>) : null}
      {children}
    </button>);
};
exports.Button = Button;
exports["default"] = exports.Button;
