# Claude Code Instructions for Pacioli

This file contains project-specific instructions and coding standards for Claude Code.

## Rust Documentation Standards (RS-D1001)

All public items in Rust code MUST be documented with `///` doc comments to satisfy DeepSource RS-D1001:

### Public Modules

```rust
/// Description of what this module provides.
pub mod my_module;
```

### Public Enums - Document enum AND each variant

```rust
/// Description of the enum.
pub enum MyEnum {
    /// Description of variant A.
    VariantA,
    /// Description of variant B.
    VariantB,
}
```

### Public Structs - Document struct AND public fields

```rust
/// Description of the struct.
pub struct MyStruct {
    /// Description of field.
    pub field: Type,
}
```

## TypeScript Standards

### Avoid void as generic type argument (JS-0333)

```typescript
// BAD
return invoke<void>('command_name', args)

// GOOD
await invoke('command_name', args)
```

### Avoid duplicate exports (JS-E1004)

When adding new types, check `src/types/index.ts` for existing exports with the same name. Use aliases if needed:

```typescript
export { MyType as AliasedType } from './myModule'
```

## Commit Messages

Do not include `Co-Authored-By` lines unless explicitly requested.
