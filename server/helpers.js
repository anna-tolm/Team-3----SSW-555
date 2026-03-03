export const helperMethods = {
  checkString(str, varName) {
    if (!str) throw `${varName} is not provided`;
    if (typeof str !== 'string') throw `${varName} is not a string`;
    if (str.trim().length === 0) throw `${varName} cannot be an empty string or just spaces`;
    return str.trim();
  },

  checkId(id, varName = 'id') {
    id = this.checkString(id, varName);
    if (!/^[0-9a-fA-F]{24}$/.test(id)) throw `${varName} is not a valid ObjectId`;
    return id;
  },

  checkEmail(email) {
    email = this.checkString(email, 'email');
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRegex.test(email)) throw 'Invalid email format';
    return email;
  },

  checkPassword(password) {
    password = this.checkString(password, 'password');
    if (password.length < 8) throw 'Password must be at least 8 characters long';
    return password;
  },

  checkPositiveNumber(val, varName) {
    if (val === undefined || val === null) throw `${varName} is not provided`;
    const n = Number(val);
    if (Number.isNaN(n) || n <= 0) throw `${varName} must be a positive number`;
    return n;
  },

  checkNonNegativeNumber(val, varName) {
    if (val === undefined || val === null) throw `${varName} is not provided`;
    const n = Number(val);
    if (Number.isNaN(n) || n < 0) throw `${varName} must be a non-negative number`;
    return n;
  },

  checkDate(dateStr, varName = 'date') {
    const d = new Date(dateStr);
    if (Number.isNaN(d.getTime())) throw `Invalid ${varName}`;
    return d.toISOString().split('T')[0];
  }
};