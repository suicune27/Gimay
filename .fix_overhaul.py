# Comprehensive overhaul: replace allSamplesRef + push + splice with SampleBuffer.

def fix_suite():
    with open('src/components/SmokeSuitePanel.tsx', 'rb') as f:
        raw = f.read()
    text = raw.decode('utf-8')
    changes = 0
    eol = '\r\n' if '\r\n' in text else '\n'

    # 1. Add import for SmokeTestPool
    old_import = "import { isElectron } from '../lib/platform';"
    add_line = "import { SampleBuffer, createMetrics, recordSample, RequestPool, maybeGC, PAYLOAD_TRUNCATED } from '../services/SmokeTestPool';"
    new_import = old_import + eol + add_line
    if old_import in text:
        text = text.replace(old_import, new_import, 1)
        changes += 1
        print('Suite: added SmokeTestPool import')
    else:
        old_import2 = old_import.replace('\n', '\r\n')
        new_import2 = new_import.replace('\n', '\r\n')
        if old_import2 in text:
            text = text.replace(old_import2, new_import2, 1)
            changes += 1
            print('Suite: added SmokeTestPool import (CRLF)')
    
    # 2. Add sampleBufferRef and requestPool ref declarations
    old_refs = '  const allSamplesRef = useRef<any[]>([]);\n  const isRunningRef = useRef(false);'
    new_refs = '  const sampleBufferRef = useRef<SampleBuffer>(new SampleBuffer(60));\n  const requestPoolRef = useRef<RequestPool>(new RequestPool(20));\n  const allSamplesRef = useRef<any[]>([]);\n  const isRunningRef = useRef(false);'
    for nl in ['\n', '\r\n']:
        old_r = old_refs.replace('\n', nl)
        new_r = new_refs.replace('\n', nl)
        if old_r in text:
            text = text.replace(old_r, new_r, 1)
            changes += 1
            print('Suite: added sampleBufferRef + requestPoolRef')
            break
    else:
        print('Suite: refs NOT FOUND')

    # 3. Replace push(newSample)
    c = text.count('allSamplesRef.current.push(newSample)')
    if c > 0:
        text = text.replace('allSamplesRef.current.push(newSample)', 'sampleBufferRef.current.push(newSample)')
        changes += 1
        print('Suite: replaced ' + str(c) + ' push(newSample)')

    # 4. AUTH_REFRESH push (try both EOL variants)
    for nl in ['\n', '\r\n']:
        old = 'allSamplesRef.current.push({' + nl + '                    id: completedCountRef.current,' + nl + "                    status: 'AUTH_REFRESH'," + nl + '                    success: false,' + nl + '                    latency: 0' + nl + '                  });'
        new = 'sampleBufferRef.current.push({' + nl + '                    id: completedCountRef.current,' + nl + "                    timestamp: new Date().toLocaleTimeString()," + nl + "                    status: 'AUTH_REFRESH'," + nl + '                    success: false,' + nl + '                    latency: 0' + nl + '                  });'
        if old in text:
            text = text.replace(old, new, 1)
            changes += 1
            print('Suite: replaced AUTH_REFRESH push')
            break
    else:
        print('Suite: AUTH_REFRESH push NOT FOUND')

    # 5. Remove splice trims
    for variant in [
        'if (allSamplesRef.current.length > 60) allSamplesRef.current.splice(0, allSamplesRef.current.length - 50);',
        'if (allSamplesRef.current.length > 60) allSamplesRef.current.splice(0, allSamplesRef.current.length - 50);\r'
    ]:
        c = text.count(variant)
        if c > 0:
            text = text.replace(variant, '')
            changes += 1
            print('Suite: removed ' + str(c) + ' splice trims')
            break

    # 6. Remove cooling splice
    for variant in [
        "allSamplesRef.current.splice(0, Math.max(0, allSamplesRef.current.length - 20));",
        "allSamplesRef.current.splice(0, Math.max(0, allSamplesRef.current.length - 20));\r"
    ]:
        c = text.count(variant)
        if c > 0:
            text = text.replace(variant, '')
            changes += 1
            print('Suite: removed ' + str(c) + ' cooling splices')

    # 7. Replace interval slice(-100) or slice(-Math.min(...))
    for variant in [
        'setSamples(allSamplesRef.current.slice(-Math.min(100, allSamplesRef.current.length)));',
        'setSamples(allSamplesRef.current.slice(-Math.min(100, allSamplesRef.current.length)));\r',
        'setSamples(sampleBufferRef.current.readLast(100));',
        'setSamples(sampleBufferRef.current.readLast(100));\r'
    ]:
        if variant in text:
            # Only replace if it's still using allSamplesRef
            if 'allSamplesRef' in variant:
                new_v = 'setSamples(sampleBufferRef.current.readLast(100));'
                text = text.replace(variant, new_v, 1)
                changes += 1
                print('Suite: replaced interval slice with readLast')
            break
    else:
        # Check if already replaced
        if 'setSamples(sampleBufferRef.current.readLast(100))' in text:
            print('Suite: interval already using readLast')
        else:
            print('Suite: interval slice NOT FOUND')

    # 8. Replace slice(-20) with readLast
    c = text.count('const recentSamples = allSamplesRef.current.slice(-20);')
    if c > 0:
        text = text.replace('const recentSamples = allSamplesRef.current.slice(-20);', 'const recentSamples = sampleBufferRef.current.readLast(20);')
        changes += 1
        print('Suite: replaced ' + str(c) + ' slice(-20)')
    else:
        # Try CRLF variant
        old = 'const recentSamples = allSamplesRef.current.slice(-20);\r'
        new = 'const recentSamples = sampleBufferRef.current.readLast(20);\r'
        if old in text:
            text = text.replace(old, new)
            changes += 1
            print('Suite: replaced slice(-20) (CRLF)')

    # 9. Replace [...allSamplesRef] with readLast
    c = text.count('setSamples([...allSamplesRef.current]);')
    if c > 0:
        text = text.replace('setSamples([...allSamplesRef.current]);', 'setSamples(sampleBufferRef.current.readLast(100));')
        changes += 1
        print('Suite: replaced ' + str(c) + ' [...allSamplesRef]')

    # 10. Replace PAYLOAD_TRUNCATED strings
    old_payload = "'[Detailed payload logging suspended for memory optimization]'"
    c = text.count(old_payload)
    if c > 0:
        text = text.replace(old_payload, 'PAYLOAD_TRUNCATED')
        changes += 1
        print('Suite: replaced ' + str(c) + ' PAYLOAD_TRUNCATED')

    # 11. Add buffer.clear() after allSamplesRef resets
    old_clear = 'allSamplesRef.current = [];'
    c = text.count(old_clear)
    if c > 0:
        text = text.replace(old_clear, 'allSamplesRef.current = [];\n    sampleBufferRef.current.clear();')
        changes += 1
        print('Suite: added buffer.clear() after ' + str(c) + ' resets')

    # 12. Add maybeGC after first gc() call
    old_gc = "try { (window as any).gc(); } catch {}"
    # Only replace first occurrence
    new_gc = "try { (window as any).gc(); } catch {}\n      maybeGC(1, 1);"
    for nl in ['\n', '\r\n']:
        old_g = old_gc.replace('\n', nl)
        new_g = new_gc.replace('\n', nl)
        if old_g in text:
            text = text.replace(old_g, new_g, 1)
            changes += 1
            print('Suite: added maybeGC after gc')
            break
    else:
        print('Suite: gc call NOT FOUND')

    with open('src/components/SmokeSuitePanel.tsx', 'wb') as f:
        f.write(text.encode('utf-8'))
    return changes


def fix_test():
    with open('src/components/SmokeTestPanel.tsx', 'rb') as f:
        raw = f.read()
    text = raw.decode('utf-8')
    changes = 0
    eol = '\r\n' if '\r\n' in text else '\n'

    # 1. Add import
    old_import = "import { SandboxRunner } from '../services/sandboxRunner';"
    add_line = "import { SampleBuffer, createMetrics, recordSample, RequestPool, maybeGC, PAYLOAD_TRUNCATED } from '../services/SmokeTestPool';"
    new_import = old_import + eol + add_line
    if old_import in text:
        text = text.replace(old_import, new_import, 1)
        changes += 1
        print('Test: added SmokeTestPool import')
    else:
        old_i2 = old_import.replace('\n', '\r\n')
        new_i2 = new_import.replace('\n', '\r\n')
        if old_i2 in text:
            text = text.replace(old_i2, new_i2, 1)
            changes += 1
            print('Test: added SmokeTestPool import (CRLF)')

    # 2. Add sampleBufferRef
    old_refs = '  const allSamplesRef = useRef<TestSample[]>([]);\n  const isRunningRef = useRef(false);'
    new_refs = '  const sampleBufferRef = useRef<SampleBuffer>(new SampleBuffer(60));\n  const allSamplesRef = useRef<TestSample[]>([]);\n  const isRunningRef = useRef(false);'
    for nl in ['\n', '\r\n']:
        old_r = old_refs.replace('\n', nl)
        new_r = new_refs.replace('\n', nl)
        if old_r in text:
            text = text.replace(old_r, new_r, 1)
            changes += 1
            print('Test: added sampleBufferRef')
            break
    else:
        print('Test: refs NOT FOUND')

    # 3. Loop branch push
    for nl in ['\n', '\r\n']:
        old = 'allSamplesRef.current.push({' + nl + '            id: runStats.completed,' + nl + '            timestamp: new Date().toLocaleTimeString(),' + nl + '            latency: duration, status, success,' + nl + '            error: errorMsg || undefined' + nl + '          });'
        new = 'sampleBufferRef.current.push({' + nl + '            id: runStats.completed,' + nl + '            timestamp: new Date().toLocaleTimeString(),' + nl + '            latency: duration, status, success,' + nl + '            error: errorMsg || undefined' + nl + '          });'
        if old in text:
            text = text.replace(old, new, 1)
            changes += 1
            print('Test: replaced loop push')
            break
    else:
        print('Test: loop push NOT FOUND')

    # 4. MoT AUTH_REFRESH push
    for nl in ['\n', '\r\n']:
        old = 'allSamplesRef.current.push({' + nl + '                    id: completedCountRef.current,' + nl + '                    timestamp: new Date().toLocaleTimeString(),' + nl + "                    status: 'AUTH_REFRESH', success: false, latency: 0" + nl + '                  });'
        new = 'sampleBufferRef.current.push({' + nl + '                    id: completedCountRef.current,' + nl + '                    timestamp: new Date().toLocaleTimeString(),' + nl + "                    status: 'AUTH_REFRESH', success: false, latency: 0" + nl + '                  });'
        if old in text:
            text = text.replace(old, new, 1)
            changes += 1
            print('Test: replaced AUTH_REFRESH push')
            break
    else:
        print('Test: AUTH_REFRESH push NOT FOUND')

    # 5. MoT normal push
    for nl in ['\n', '\r\n']:
        old = 'allSamplesRef.current.push({' + nl + '            id: completedCountRef.current,' + nl + '            timestamp: new Date().toLocaleTimeString(),' + nl + '            status, success, latency: duration,' + nl + '            error: errorMsg || undefined' + nl + '          });'
        new = 'sampleBufferRef.current.push({' + nl + '            id: completedCountRef.current,' + nl + '            timestamp: new Date().toLocaleTimeString(),' + nl + '            status, success, latency: duration,' + nl + '            error: errorMsg || undefined' + nl + '          });'
        if old in text:
            text = text.replace(old, new, 1)
            changes += 1
            print('Test: replaced MoT push')
            break
    else:
        print('Test: MoT push NOT FOUND')

    # 6. Remove splice trims
    for variant in [
        'if (allSamplesRef.current.length > 60) allSamplesRef.current.splice(0, allSamplesRef.current.length - 50);',
        'if (allSamplesRef.current.length > 60) allSamplesRef.current.splice(0, allSamplesRef.current.length - 50);\r'
    ]:
        c = text.count(variant)
        if c > 0:
            text = text.replace(variant, '')
            changes += 1
            print('Test: removed ' + str(c) + ' splice trims')
            break

    # 7. Remove cooling splice
    for variant in [
        "allSamplesRef.current.splice(0, Math.max(0, allSamplesRef.current.length - 20));",
        "allSamplesRef.current.splice(0, Math.max(0, allSamplesRef.current.length - 20));\r"
    ]:
        c = text.count(variant)
        if c > 0:
            text = text.replace(variant, '')
            changes += 1
            print('Test: removed ' + str(c) + ' cooling splices')

    # 8. Replace setSamples calls
    c = text.count('setSamples([...allSamplesRef.current]);')
    if c > 0:
        text = text.replace('setSamples([...allSamplesRef.current]);', 'setSamples(sampleBufferRef.current.readLast(100));')
        changes += 1
        print('Test: replaced ' + str(c) + ' setSamples')

    # 9. Replace slice(-20)
    old_s20 = 'const recentSamples = allSamplesRef.current.slice(-20);'
    new_s20 = 'const recentSamples = sampleBufferRef.current.readLast(20);'
    if old_s20 in text:
        text = text.replace(old_s20, new_s20, 1)
        changes += 1
        print('Test: replaced slice(-20)')

    # 10. Add buffer.clear() after allSamplesRef resets
    old_clear = 'allSamplesRef.current = [];'
    c = text.count(old_clear)
    if c > 0:
        text = text.replace(old_clear, 'allSamplesRef.current = [];\n    sampleBufferRef.current.clear();')
        changes += 1
        print('Test: added buffer.clear() after ' + str(c) + ' resets')

    # 11. Add maybeGC
    old_gc = "try { (window as any).gc(); } catch {}"
    new_gc = "try { (window as any).gc(); } catch {}\n      maybeGC(1, 1);"
    if old_gc in text:
        text = text.replace(old_gc, new_gc, 1)
        changes += 1
        print('Test: added maybeGC')

    with open('src/components/SmokeTestPanel.tsx', 'wb') as f:
        f.write(text.encode('utf-8'))
    return changes

s = fix_suite()
print('\n--- SmokeTestPanel.tsx ---')
t = fix_test()
print('\nSuite: ' + str(s) + ' changes | Test: ' + str(t) + ' changes | Total: ' + str(s + t))
