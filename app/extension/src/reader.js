// Injected into the page when you click the WFD button: reads the recipe the same way WFD's server import does.
import { readRecipeFromDocument } from '../../src/lib/readrecipe.js';
window.__wfdPage = { url: location.href, recipes: readRecipeFromDocument(document, location.href) };
