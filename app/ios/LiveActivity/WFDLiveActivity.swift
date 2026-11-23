// Cook-day progress on the Lock Screen, Dynamic Island and Apple Watch Smart Stack.
// Values come from the app (src/lib/live.js): title, step, of, text, next, timerEnd (epoch ms), timerLabel.
import ActivityKit
import SwiftUI
import WidgetKit

@main
struct WFDWidgets: WidgetBundle {
    var body: some Widget { WFDLiveActivity() }
}

private let accent = Color(red: 0.122, green: 0.373, blue: 0.82)

@available(iOS 16.2, *)
private struct Progress: View {
    let step: Int, of: Int
    var body: some View {
        ProgressView(value: Double(max(0, min(step, of))), total: Double(max(of, 1))).tint(accent)
    }
}

@available(iOS 16.2, *)
private func timerEnd(_ v: [String: String]) -> Date? {
    guard let s = v["timerEnd"], let ms = Double(s), ms > 0 else { return nil }
    let d = Date(timeIntervalSince1970: ms / 1000)
    return d > Date() ? d : nil
}

@available(iOS 16.2, *)
struct WFDLiveActivity: Widget {
    var body: some WidgetConfiguration {
        ActivityConfiguration(for: GenericAttributes.self) { context in
            let v = context.state.values
            let step = Int(v["step"] ?? "0") ?? 0, of = Int(v["of"] ?? "0") ?? 0
            VStack(alignment: .leading, spacing: 6) {
                HStack {
                    Text("🔪 \(v["title"] ?? "Cook day")").font(.headline).lineLimit(1)
                    Spacer()
                    Text("Step \(step) of \(of)").font(.caption).foregroundStyle(.secondary)
                }
                Text(v["text"] ?? "").font(.subheadline).lineLimit(2)
                Progress(step: step, of: of)
                HStack {
                    if let end = timerEnd(v) {
                        Label { Text(timerInterval: Date()...end, countsDown: true).monospacedDigit() } icon: { Text("⏰") }
                            .font(.caption.bold())
                        Text(v["timerLabel"] ?? "").font(.caption).lineLimit(1)
                    } else if let next = v["next"], !next.isEmpty {
                        Text("Up next: \(next)").font(.caption).foregroundStyle(.secondary).lineLimit(1)
                    }
                    Spacer()
                }
            }
            .padding(14)
            .activityBackgroundTint(Color(red: 0.965, green: 0.957, blue: 0.933))
            .activitySystemActionForegroundColor(accent)
        } dynamicIsland: { context in
            let v = context.state.values
            let step = Int(v["step"] ?? "0") ?? 0, of = Int(v["of"] ?? "0") ?? 0
            return DynamicIsland {
                DynamicIslandExpandedRegion(.leading) { Text("🔪 \(step)/\(of)").font(.headline) }
                DynamicIslandExpandedRegion(.trailing) {
                    if let end = timerEnd(v) { Text(timerInterval: Date()...end, countsDown: true).monospacedDigit().frame(width: 56) }
                }
                DynamicIslandExpandedRegion(.bottom) {
                    VStack(alignment: .leading, spacing: 4) {
                        Text(v["text"] ?? "").font(.subheadline).lineLimit(2)
                        Progress(step: step, of: of)
                    }
                }
            } compactLeading: {
                Text("🔪")
            } compactTrailing: {
                if let end = timerEnd(v) { Text(timerInterval: Date()...end, countsDown: true).monospacedDigit().frame(width: 44) }
                else { Text("\(step)/\(of)").monospacedDigit() }
            } minimal: {
                Text("\(step)")
            }
        }
    }
}
