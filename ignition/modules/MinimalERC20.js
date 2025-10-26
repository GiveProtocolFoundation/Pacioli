const { buildModule } = require('@nomicfoundation/hardhat-ignition/modules')

module.exports = buildModule('MinimalERC20Module', m => {
  // Deploy MinimalERC20 with name and symbol
  const token = m.contract('MinimalERC20', [
    'Numbers Token', // name
    'NUM', // symbol
  ])

  return { token }
})
