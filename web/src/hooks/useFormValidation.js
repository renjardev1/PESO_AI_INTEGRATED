// pesir/src/hooks/useFormValidation.js
// Reusable React form-validation hook with DOMPurify sanitization and inline errors.
import { useMemo, useState } from 'react';
import DOMPurify from 'dompurify';

const PASSWORD_REGEX = {
  minLen: /.{8,}/,
  upper: /[A-Z]/,
  number: /\d/,
  symbol: /[^A-Za-z0-9]/,
};

const sanitizeInput = (value = '') =>
  DOMPurify.sanitize(String(value), { ALLOWED_TAGS: [], ALLOWED_ATTR: [] }).trim();

const validateField = (name, value, rules = {}) => {
  if (rules.required && !value) return `${name} is required.`;
  if (!value) return '';

  if (rules.email) {
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRegex.test(value)) return 'Enter a valid email address.';
  }

  if (rules.passwordStrength) {
    if (!PASSWORD_REGEX.minLen.test(value)) return 'Password must be at least 8 characters.';
    if (!PASSWORD_REGEX.upper.test(value)) return 'Password must include an uppercase letter.';
    if (!PASSWORD_REGEX.number.test(value)) return 'Password must include a number.';
    if (!PASSWORD_REGEX.symbol.test(value)) return 'Password must include a symbol.';
  }

  if (typeof rules.custom === 'function') {
    const customError = rules.custom(value);
    if (customError) return customError;
  }

  return '';
};

export const useFormValidation = (schema, initialState = {}) => {
  const [values, setValues] = useState(initialState);
  const [errors, setErrors] = useState({});
  const [touched, setTouched] = useState({});

  const validateAll = (nextValues) => {
    const nextErrors = {};
    Object.keys(schema).forEach((name) => {
      const value = sanitizeInput(nextValues[name] ?? '');
      const message = validateField(name, value, schema[name]);
      if (message) nextErrors[name] = message;
    });
    return nextErrors;
  };

  const updateField = (name, rawValue) => {
    const sanitized = sanitizeInput(rawValue);
    const nextValues = { ...values, [name]: sanitized };
    const fieldError = validateField(name, sanitized, schema[name]);

    setValues(nextValues);
    setErrors((prev) => ({ ...prev, [name]: fieldError }));
    return nextValues;
  };

  const handleChange = (e) => updateField(e.target.name, e.target.value);

  const handleBlur = (e) => {
    const { name } = e.target;
    setTouched((prev) => ({ ...prev, [name]: true }));
    const sanitized = sanitizeInput(values[name] ?? '');
    const fieldError = validateField(name, sanitized, schema[name]);
    setErrors((prev) => ({ ...prev, [name]: fieldError }));
  };

  const setFieldValue = (name, value) => updateField(name, value);

  const runValidation = () => {
    const nextErrors = validateAll(values);
    setErrors(nextErrors);
    setTouched(
      Object.keys(schema).reduce((acc, key) => ({ ...acc, [key]: true }), {})
    );
    return Object.keys(nextErrors).length === 0;
  };

  const isFormValid = useMemo(() => {
    const nextErrors = validateAll(values);
    return Object.keys(nextErrors).length === 0;
  }, [schema, values]);

  return {
    values,
    errors,
    touched,
    setValues,
    setFieldValue,
    handleChange,
    handleBlur,
    runValidation,
    isFormValid,
  };
};

