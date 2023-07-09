function extractProductName(url) {
  const segments = url.split('/');
  let productName = '';
  const productNameIndex = segments.findIndex(segment =>
    segment.includes('products') ||
    segment.includes('item') ||
    segment === 'p'
  );

  if (productNameIndex !== -1) {
    productName = segments[productNameIndex + 1];
  }

  return decodeURIComponent(productName.replace(/-/g, ' '));
}


/*
const url1 = 'https://www.example.com/products/bosch-kosilica-arm-32-0600885b03-proizvod-8733/';
const url2 = 'https://www.example.com/item/einhell-ge-pm-53-2-s-hw-e-li/';
const url3 = 'https://www.example.com/p/another-product';

const product1 = extractProductName(url1);
const product2 = extractProductName(url2);
const product3 = extractProductName(url3);

console.log('Product 1:', product1);
console.log('Product 2:', product2);
console.log('Product 3:', product3);
*/

module.exports = extractProductName;