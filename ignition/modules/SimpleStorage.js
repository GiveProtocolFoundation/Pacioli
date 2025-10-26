const { buildModule } = require('@nomicfoundation/hardhat-ignition/modules')

module.exports = buildModule('SimpleStorageModule', m => {
  // Deploy SimpleStorage contract
  const simpleStorage = m.contract('SimpleStorage', [])

  // Log the deployment
  m.call(simpleStorage, 'getValue', [], {
    id: 'get-initial-value',
  })

  return { simpleStorage }
})
