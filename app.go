package main

import (
	"context"
	"fmt"
	"io/ioutil"
	"os"
	"path/filepath"
	"strings"
	"time"

	"github.com/wailsapp/wails/v2/pkg/runtime"
)

type App struct {
	ctx            context.Context
	currentProject string
	recentFiles    []string
}

type FileInfo struct {
	Name     string `json:"name"`
	Path     string `json:"path"`
	IsDir    bool   `json:"isDir"`
	Size     int64  `json:"size"`
	Modified string `json:"modified"`
}

func NewApp() *App {
	return &App{
		recentFiles: make([]string, 0),
	}
}

func (a *App) startup(ctx context.Context) {
	a.ctx = ctx
}

func (a *App) Greet(name string) string {
	return fmt.Sprintf("Hello %s, It's show time!", name)
}

func (a *App) ReadFile(filePath string) (string, error) {
	content, err := ioutil.ReadFile(filePath)
	if err != nil {
		return "", err
	}
	a.addToRecent(filePath)
	return string(content), nil
}

func (a *App) WriteFile(filePath, content string) error {
	dir := filepath.Dir(filePath)
	if err := os.MkdirAll(dir, 0755); err != nil {
		return err
	}
	return ioutil.WriteFile(filePath, []byte(content), 0644)
}

func (a *App) CreateFile(filePath string) error {
	dir := filepath.Dir(filePath)
	if err := os.MkdirAll(dir, 0755); err != nil {
		return err
	}
	return ioutil.WriteFile(filePath, []byte(""), 0644)
}

func (a *App) CreateFolder(folderPath string) error {
	return os.MkdirAll(folderPath, 0755)
}

func (a *App) DeleteFile(filePath string) error {
	return os.RemoveAll(filePath)
}

func (a *App) ListFiles(dirPath string) ([]FileInfo, error) {
	if dirPath == "" {
		dirPath = "."
	}

	files, err := ioutil.ReadDir(dirPath)
	if err != nil {
		return nil, err
	}

	var fileInfos []FileInfo
	for _, file := range files {

		if strings.HasPrefix(file.Name(), ".") {
			continue
		}

		filePath := filepath.Join(dirPath, file.Name())
		fileInfo := FileInfo{
			Name:     file.Name(),
			Path:     filePath,
			IsDir:    file.IsDir(),
			Size:     file.Size(),
			Modified: file.ModTime().Format(time.RFC3339),
		}
		fileInfos = append(fileInfos, fileInfo)
	}

	return fileInfos, nil
}

func (a *App) GetCurrentProject() string {
	return a.currentProject
}

func (a *App) SetCurrentProject(projectPath string) {
	a.currentProject = projectPath
}

func (a *App) GetRecentFiles() []string {
	return a.recentFiles
}

func (a *App) addToRecent(filePath string) {

	for i, recent := range a.recentFiles {
		if recent == filePath {
			a.recentFiles = append(a.recentFiles[:i], a.recentFiles[i+1:]...)
			break
		}
	}

	a.recentFiles = append([]string{filePath}, a.recentFiles...)

	if len(a.recentFiles) > 10 {
		a.recentFiles = a.recentFiles[:10]
	}
}

func (a *App) FileExists(filePath string) bool {
	_, err := os.Stat(filePath)
	return !os.IsNotExist(err)
}

func (a *App) OpenFileDialog() (string, error) {
	filePath, err := runtime.OpenFileDialog(a.ctx, runtime.OpenDialogOptions{
		Title: "Open File",
		Filters: []runtime.FileFilter{
			{DisplayName: "All Files", Pattern: "*"},
			{DisplayName: "Text Files", Pattern: "*.txt;*.md;*.json;*.yml;*.yaml"},
			{DisplayName: "Code Files", Pattern: "*.js;*.ts;*.jsx;*.tsx;*.html;*.css;*.py;*.go;*.rs;*.java;*.cpp;*.c"},
		},
	})
	return filePath, err
}

func (a *App) OpenDirectoryDialog() (string, error) {
	dirPath, err := runtime.OpenDirectoryDialog(a.ctx, runtime.OpenDialogOptions{
		Title: "Open Folder",
	})
	return dirPath, err
}

func (a *App) SaveFileDialog(defaultFilename string) (string, error) {
	filePath, err := runtime.SaveFileDialog(a.ctx, runtime.SaveDialogOptions{
		Title:           "Save File",
		DefaultFilename: defaultFilename,
		Filters: []runtime.FileFilter{
			{DisplayName: "All Files", Pattern: "*"},
			{DisplayName: "Text Files", Pattern: "*.txt;*.md;*.json;*.yml;*.yaml"},
			{DisplayName: "Code Files", Pattern: "*.js;*.ts;*.jsx;*.tsx;*.html;*.css;*.py;*.go;*.rs;*.java;*.cpp;*.c"},
		},
	})
	return filePath, err
}

func (a *App) ToggleFullscreen() {
	runtime.WindowToggleMaximise(a.ctx)
}

func (a *App) SetFullscreen(fullscreen bool) {
	if fullscreen {
		runtime.WindowMaximise(a.ctx)
	} else {
		runtime.WindowUnmaximise(a.ctx)
	}
}

func (a *App) ToggleMaximize() {
	runtime.WindowToggleMaximise(a.ctx)
}
