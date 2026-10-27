import SwiftUI

/// The collapsed state: a dachshund typing on a laptop at a small desk.
///
/// The sticky note on the laptop lid shows how many tasks are left. The drawing is made of
/// simple shapes laid out on a 140×104 canvas and animated in discrete steps (paws typing,
/// tail wagging, an occasional blink) driven by a `TimelineView`.
struct DachshundDesk: View {
    let count: Int
    let hasError: Bool
    let mover: WindowMover

    /// Duration of one animation step.
    private let tick: TimeInterval = 0.16

    /// The animated drawing, draggable, with the task count as tooltip.
    var body: some View {
        TimelineView(.periodic(from: .now, by: tick)) { context in
            scene(step: Int(context.date.timeIntervalSinceReferenceDate / tick))
                // The drawing has some empty margin; shift it so the window hugs the dog.
                .offset(x: -6, y: -11)
        }
        .frame(width: 140, height: 93, alignment: .topLeading)
        .contentShape(Rectangle())
        .gesture(DragGesture(minimumDistance: 2)
            .onChanged { _ in mover.changed() }
            .onEnded { _ in mover.ended() })
        .help("\(count) pendiente\(count == 1 ? "" : "s")")
    }

    /// One animation frame.
    /// - Parameter step: Monotonic step counter; its parity drives the paws and tail.
    private func scene(step: Int) -> some View {
        let leftPawUp = step % 2 == 0
        let tailUp = (step / 2) % 2 == 0
        let blinking = step % 28 == 0

        return ZStack(alignment: .topLeading) {
            // Shadow on the floor
            part(Ellipse(), Color.black.opacity(0.10), x: 70, y: 99, w: 124, h: 7)

            // Tail, wagging
            Capsule().fill(Color.fur)
                .frame(width: 22, height: 6)
                .rotationEffect(.degrees(tailUp ? -24 : 10), anchor: .leading)
                .position(x: 134, y: 46)

            // Long sausage body, peeking out from behind the desk
            part(Capsule(), .fur, x: 86, y: 54, w: 92, h: 28)
            part(Capsule(), .furDark.opacity(0.22), x: 96, y: 45, w: 56, h: 6)

            // Head
            part(Ellipse(), .furDark, x: 27, y: 36, w: 11, h: 25)   // left ear
            part(Ellipse(), .furDark, x: 57, y: 36, w: 11, h: 25)   // right ear
            part(Ellipse(), .fur, x: 42, y: 28, w: 32, h: 28)
            part(Ellipse(), .furLight, x: 42, y: 38, w: 18, h: 12)  // snout
            part(Ellipse(), .black, x: 42, y: 34, w: 7, h: 5)       // nose
            part(Capsule(), .black, x: 35, y: 25, w: 4, h: blinking ? 1 : 5)
            part(Capsule(), .black, x: 49, y: 25, w: 4, h: blinking ? 1 : 5)

            // Desk
            part(RoundedRectangle(cornerRadius: 2), .woodDark, x: 18, y: 84, w: 4, h: 30)
            part(RoundedRectangle(cornerRadius: 2), .woodDark, x: 122, y: 84, w: 4, h: 30)
            part(RoundedRectangle(cornerRadius: 3), .wood, x: 70, y: 67, w: 126, h: 7)

            // Coffee mug
            part(RoundedRectangle(cornerRadius: 2), .white, x: 104, y: 58, w: 10, h: 11)
            Circle().stroke(Color.white, lineWidth: 2)
                .frame(width: 6, height: 6)
                .position(x: 110, y: 58)

            // Laptop, seen from behind, with the counter sticker
            part(RoundedRectangle(cornerRadius: 1), Color(white: 0.6), x: 46, y: 63, w: 54, h: 3)
            part(RoundedRectangle(cornerRadius: 4), .lid, x: 46, y: 52, w: 46, h: 22)
            sticker.position(x: 46, y: 52)

            // Paws, typing
            part(Capsule(), .fur, x: 31, y: leftPawUp ? 38 : 41, w: 9, h: 8)
            part(Capsule(), .fur, x: 61, y: leftPawUp ? 41 : 38, w: 9, h: 8)

            if hasError {
                Text("!")
                    .font(.system(size: 11, weight: .heavy, design: .rounded))
                    .foregroundColor(.white)
                    .frame(width: 16, height: 16)
                    .background(Circle().fill(Color.red))
                    .position(x: 64, y: 18)
            }
        }
        .frame(width: 140, height: 104)
    }

    /// Sticky note with the number of open tasks, or a tick when there are none.
    private var sticker: some View {
        Text(count > 0 ? "\(count)" : "✓")
            .font(.system(size: 12, weight: .heavy, design: .rounded))
            .foregroundColor(Color.black.opacity(0.8))
            .frame(minWidth: 18, minHeight: 15)
            .padding(.horizontal, 3)
            .background(RoundedRectangle(cornerRadius: 3).fill(Color.highlight))
            .rotationEffect(.degrees(-4))
    }

    /// Places a filled shape centred at (`x`, `y`) with the given size.
    private func part<S: Shape>(_ shape: S, _ color: Color, x: CGFloat, y: CGFloat, w: CGFloat, h: CGFloat) -> some View {
        shape.fill(color).frame(width: w, height: h).position(x: x, y: y)
    }
}
