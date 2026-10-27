// swift-tools-version:5.9
import PackageDescription

let package = Package(
    name: "Salchi",
    platforms: [.macOS(.v13)],
    targets: [
        .executableTarget(name: "Salchi", path: "Sources/Salchi")
    ]
)
