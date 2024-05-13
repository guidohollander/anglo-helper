/* eslint-disable no-restricted-syntax */
const fs = require('fs');
const { render } = require('mustache');
const list = require('markdown-list');
const path = require('path');
const state = require('./state');


async function renderComponentObject(componentEntry, jiraCollection) {
  componentEntry.jiraIssues = jiraCollection ? list(jiraCollection.jiraIssues.map((a) => `JIRA:${a.jiraIssueNumber}`)) : '';
  return componentEntry;
}
async function performComponent(componentEntry, jiraCollection) {
  if (componentEntry.isCoreComponent) {
    const component = await renderComponentObject(componentEntry, jiraCollection);
    const templateFilePath = path.join(__dirname, '/templates/component_template.mst');
    const output = render(fs.readFileSync(templateFilePath).toString(), component);
    const componentDir = `${state.profile.obsidian}/components/`;
    const dir = `${componentDir}${componentEntry.bareComponentName.replace(' ', '-').replace('/', '-')}`;
    const filename = `${dir}/${componentEntry.componentName.replace(' ', '-')}-${componentEntry.relativeUrl.replace('/', '-')}`.toLowerCase();
    if (!fs.existsSync(componentDir)) {
      fs.mkdirSync(componentDir);
    }
    if (!fs.existsSync(dir)) {
      fs.mkdirSync(dir);
    }
    fs.writeFileSync(`${filename}.md`, output);
  }
}
async function renderImplementationObject(implementation, internalsAndExternals, jiraCollection) {
  const returnImplementation = {
    name: implementation.oAppContext.solution,
    version: implementation.oSolution.current.tagNumber,
    releaseDate: new Date().toISOString().replaceAll('T', '').replaceAll(':', ''),
    solution: implementation.oAppContext.app,
    country: implementation.currentSolution.customer,
    customerCode: implementation.currentSolution.customerCode,
    internals: list(internalsAndExternals.filter((x) => x.isInternal).map((a) => a.key)),
    externals: list(internalsAndExternals.filter((x) => x.isExternal && x.isCoreComponent && !x.isFrontend).map((a) => `[[${a.componentName.replace(' ', '-')}-${a.relativeUrl.replace('/', '-')}|${a.componentName} ${a.relativeUrl.replace('tags/', '')}]]`)),
    jiraIssues: jiraCollection.length > 0 ? list(jiraCollection.map((a) => a.jiraIssues).map((b) => b.map((c) => `JIRA:${c.jiraIssueNumber}`)).flat()) : '',
  };
  return returnImplementation;
}

async function performImplementation(implementationRaw, internalsAndExternalsRaw, jiraCollection) {
  const implementation = await renderImplementationObject(implementationRaw, internalsAndExternalsRaw, jiraCollection);
  const templateFilePath = path.join(__dirname, '/templates/implementation_template.mst');
  const output = render(fs.readFileSync(templateFilePath).toString(), implementation);  
  // const output = render(fs.readFileSync(`${state.profile.obsidian}/.templates/implementation_template.mst`).toString(), implementation);  
  const dir = `${state.profile.obsidian}/implementations`;
  const filename = `${dir}/${implementation.name.replace(' ', '-').replace('/', '-')}-${implementation.version.replace('/', '-')}`.toLowerCase();
  if (!fs.existsSync(dir)) {
    fs.mkdirSync(dir);
  }
  fs.writeFileSync(`${filename}.md`, output);
}

async function renderCustomerObject(Customer) {
  const returnCustomer = {
    name: Customer.currentSolution.functionalName,
    solution: Customer.oAppContext.app,
    projectFolder: Customer.oAppContext.workingCopyFolder,
    repo: Customer.remoteRepo,
    customerCode: Customer.currentSolution.customerCode,
  };
  return returnCustomer;
}

async function performCustomer(CustomerRaw) {
  const Customer = await renderCustomerObject(CustomerRaw);
  const templateFilePath = path.join(__dirname, '/templates/customer_template.mst');
  const output = render(fs.readFileSync(templateFilePath).toString(), Customer);  
  // const output = render(fs.readFileSync(`${state.profile.obsidian}/.templates/customer_template.mst`).toString(), Customer);  
  const dir = `${state.profile.obsidian}/customers`;
  const filename = `${dir}/${Customer.name.replace(' ', '-').replace('/', '-')}`.toLowerCase();
  if (!fs.existsSync(dir)) {
    fs.mkdirSync(dir);
  }
  fs.writeFileSync(`${filename}.md`, output);
}

module.exports = {
  performComponent,
  performImplementation,
  performCustomer,
};
