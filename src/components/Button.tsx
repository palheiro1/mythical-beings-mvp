import React from 'react';

export interface ButtonProps extends React.ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: 'primary' | 'secondary' | 'success' | 'danger' | 'gradient';
  size?: 'sm' | 'md' | 'lg';
  icon?: React.ReactNode;
  loading?: boolean;
  fullWidth?: boolean;
}

const baseStyles =
  'inline-flex items-center justify-center font-semibold rounded-xl shadow-md transition-all duration-200 focus:outline-none focus:ring-2 focus:ring-offset-2 disabled:opacity-50 disabled:cursor-not-allowed';

const sizeStyles = {
  sm: 'text-sm px-3 py-1.5',
  md: 'text-base px-5 py-2.5',
  lg: 'text-lg px-7 py-3',
};

const variantStyles = {
  primary:
    'bg-blue-600 hover:bg-blue-700 text-white focus:ring-blue-400',
  secondary:
    'bg-gray-600 hover:bg-gray-700 text-white focus:ring-gray-400',
  success:
    'bg-emerald-600 hover:bg-emerald-700 text-white focus:ring-emerald-400',
  danger:
    'bg-red-600 hover:bg-red-700 text-white focus:ring-red-400',
  gradient:
    'bg-gradient-to-r from-purple-500 to-indigo-600 hover:from-purple-600 hover:to-indigo-700 text-white focus:ring-indigo-400',
};

export const Button: React.FC<ButtonProps> = ({
  children,
  variant = 'primary',
  size = 'md',
  icon,
  loading = false,
  fullWidth = false,
  className = '',
  ...props
}) => {
  return (
    <button
      className={[
        baseStyles,
        sizeStyles[size],
        variantStyles[variant],
        fullWidth ? 'w-full' : '',
        className,
      ].join(' ')}
      disabled={loading || props.disabled}
      {...props}
    >
      {loading ? (
        <svg className="animate-spin h-5 w-5 mr-2 text-white" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
          <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
          <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8v4a4 4 0 00-4 4H4z" />
        </svg>
      ) : icon ? (
        <span className="mr-2 flex items-center">{icon}</span>
      ) : null}
      {children}
    </button>
  );
};

export default Button;
