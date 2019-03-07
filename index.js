'use strict';

const request = require('request');
const cheerio = require('cheerio');

function extractField($, field, selectors, nested = false) {
  let fieldOutput = '';

  for (const partialSelector of selectors[field]) {
    const {
      selector,
      text = false,
      html = false,
      attribute = null,
      group = false,
      groupSelectors
    } = partialSelector;

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

    if (group) {
      if (nested) {
        throw new Error('Nested group selectors are not allowed.');
      }

      if (!groupSelectors) {
        throw new Error('Group selection missing group selectors.');
      }

      const groupFields = [];
      const all = $(selector);

      for (let i = 0, l = all.length; i < l; i++) {
        const item = cheerio.load(all[`${i}`]);
        const fields = {};
        const selectorProperties = Object.keys(groupSelectors);

        for (const property of selectorProperties) {
          fields[property] = extractField(item, property, groupSelectors, true);
        }

        groupFields.push(fields);
      }

      return groupFields;
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

      try {
        for (const property of selectorProperties) {
          extractedFields[property] = extractField($, property, selectors);
        }
      } catch (err) {
        return reject(err);
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
