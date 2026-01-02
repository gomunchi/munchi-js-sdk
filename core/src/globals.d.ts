// This fixes the "Cannot find name 'Null'" error in OpenAPI generated files
export { };

declare global {
    type Null = null;
}