'use strict';

const request = require('request');
const cheerio = require('cheerio');

function extractField($, field, selectors) {
  let fieldOutput = '';

  for (const partialSelector of selectors[field]) {
    const { selector, text = false, html = false, attribute = null } = partialSelector;

    if (text) {
      fieldOutput += $(selector)
        .first()
        .text()
        .replace(/\r?\n/g, '')
        .trim();
    }

    if (attribute) {
      fieldOutput += $(selector)
        .first()
        .attr(attribute);
    }

    if (html) {
      fieldOutput += $(selector).html();
    }
  }

  return fieldOutput;
}

module.exports = (originUrl, config = {}) =>
  new Promise(async (resolve, reject) => {
    const { selectors = {}, httpOptions = {} } = config;
    const requestOptions = {
      method: 'GET',
      uri: originUrl,
      ...httpOptions
    };

    const reqStream = request(requestOptions, async (error, response, body) => {
      if (error) {
        return reject(error);
      }

      const $ = cheerio.load(body);
      const extractedFields = {};
      const selectorProperties = Object.keys(selectors);

      for (const property of selectorProperties) {
        extractedFields[property] = extractField($, property, selectors);
      }

      resolve(extractedFields);
    });

    reqStream.on('response', response => {
      if (response.statusCode !== 200) {
        reqStream.emit('error', new Error(`Http status code ${response.statusCode}`));
      } else if (!/text\/html/.test(response.headers['content-type'])) {
        reqStream.emit(
          'error',
          new Error(`Unsupported content type ${response.headers['content-type']}`)
        );
      }
    });
  });
