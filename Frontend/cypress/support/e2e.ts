/// <reference types="cypress" />

export {}

declare global {
  // Tipos dos comandos Cypress
  // eslint-disable-next-line @typescript-eslint/no-namespace
  namespace Cypress {
    interface Chainable {
      /** Pausa visual da apresentação. */
      demoPause(milliseconds?: number): Chainable<undefined>
    }
  }
}

function duration(key: string): number {
  const value = Number(Cypress.expose(key))
  return Number.isFinite(value) && value >= 0 ? value : 0
}
function pause<T>(value: T, key = 'actionDelay') {
  return Cypress.Promise.delay(duration(key)).then(() => value)
}

// Ajusta o ritmo das ações visuais
Cypress.Commands.add('demoPause', (milliseconds = duration('pageDelay')) => {
  return cy.then(() => Cypress.Promise.delay(milliseconds).then(() => undefined))
})
Cypress.Commands.overwrite<'click', 'element'>('click', (original, subject, ...args) =>
  original(subject, ...args).then(value => pause(value)))
Cypress.Commands.overwrite<'dblclick', 'element'>('dblclick', (original, subject, ...args) =>
  original(subject, ...args).then(value => pause(value)))
Cypress.Commands.overwrite<'select', 'element'>('select', (original, subject, ...args) =>
  original(subject, ...args).then(value => pause(value)))
Cypress.Commands.overwrite<'check', 'element'>('check', (original, subject, ...args) =>
  original(subject, ...args).then(value => pause(value)))
Cypress.Commands.overwrite<'uncheck', 'element'>('uncheck', (original, subject, ...args) =>
  original(subject, ...args).then(value => pause(value)))
Cypress.Commands.overwrite<'type', 'element'>('type', (original, subject, text, options = {}) =>
  original(subject, text, { ...options, delay: options.delay ?? duration('typeDelay') }).then(value => pause(value)))
Cypress.Commands.overwrite('visit', (original, ...args) =>
  original(...args).then(value => pause(value, 'pageDelay')))
Cypress.Commands.overwrite('reload', (original, ...args) =>
  original(...args).then(value => pause(value, 'pageDelay')))
