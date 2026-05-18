// Web stub for react-native-maps — the native module pulls in
// codegenNativeCommands which breaks the web bundle. The live-map route has
// a `.web.tsx` variant that renders an iframe instead, so this stub only
// exists to satisfy the route-graph import; nothing on the web path actually
// renders these components.
const React = require('react');

const noop = () => null;
const Stub = React.forwardRef((_, __) => null);
Stub.displayName = 'RNMapsWebStub';

module.exports = Stub;
module.exports.default = Stub;
module.exports.Marker = Stub;
module.exports.Polyline = Stub;
module.exports.Polygon = Stub;
module.exports.Circle = Stub;
module.exports.Callout = Stub;
module.exports.PROVIDER_GOOGLE = 'google';
module.exports.PROVIDER_DEFAULT = undefined;
