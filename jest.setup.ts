import '@testing-library/jest-dom';

// Polyfill Next.js Request/Response for Node environment
if (typeof Request === 'undefined') {
  global.Request = class Request {} as any;
}
if (typeof Response === 'undefined') {
  global.Response = class Response {} as any;
}
if (typeof Headers === 'undefined') {
  global.Headers = class Headers {} as any;
}
