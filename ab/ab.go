package main

import (
	"net/http"
	"os"
	"math/rand"
	"time"
	"fmt"
	"bytes"
	"strconv"
	"sync"
	"log"

	"github.com/paulbellamy/ratecounter"
	"github.com/rubyist/circuitbreaker"
	"golang.org/x/net/context"
	"googlemaps.github.io/maps"
)

const API_KEY="AIzaSyD4EIXlzwTNFdE3bvK3rxtmfmiffrrMRo8"
var wg sync.WaitGroup
var client = circuit.NewHTTPClient(time.Second * 5, 10, nil)
var counterOK = ratecounter.NewRateCounter(1 * time.Second)
var counterError = ratecounter.NewRateCounter(1 * time.Second)
var stopchan = make(chan bool)
var total = 0

//ANY
func postRandCoordinate (id int){
	defer wg.Done()
	url := fmt.Sprintf("http://%s:%s/user/%d/coordinates",SERVER_HOST,SERVER_PORT,id)
	jsonStr := []byte(fmt.Sprintf(`{"latitude":%f,"longitude":%f}`,rand.Float64()+42,rand.Float64()+43))
	req, err := http.NewRequest("POST", url, bytes.NewBuffer(jsonStr))
	if err != nil{
		counterError.Incr(1)
	}

	req.Header.Set("Content-Type", "application/json")
	resp, err := client.Do(req)
	if err != nil{
		counterError.Incr(1)
	} else {
		defer resp.Body.Close()
		
		if resp.StatusCode == 200{
			counterOK.Incr(1)
		} else {
			counterError.Incr(1)
		}
	}
	total++
}


func randomPoints(){
	drivers,_ := strconv.Atoi(os.Args[2])
	start := time.Now()
	for {
		select {
			default:
					for i := 0; i < drivers; i++ {
				    // push coordinates
				    wg.Add(1)
						go postRandCoordinate(i)
					}
					wg.Wait()
					elapsed := time.Since(start)
					fmt.Printf("\rOK:%d Req/s, ERRORS:%d Req/s TOTAL:%d, ElapsedTime:%s", counterOK.Rate(),counterError.Rate(), total, elapsed)
					if counterError.Rate() >= int64(drivers) {
						close(stopchan)
					}
					time.Sleep(time.Second)
			case <- stopchan :
				fmt.Println("\nTO MANY ERRORS STOPPING NOW!")
				os.Exit(0)
		}
	}
}

//ROUTES
func getDirections(start string, end string) []maps.LatLng {

	c, err := maps.NewClient(maps.WithAPIKey(API_KEY))
	if err != nil {
		log.Fatalf("fatal error: %s", err)
	}
	r := &maps.DirectionsRequest{
		Origin: start,
		Destination: end,
		Mode:"walking",
	}
	route, _, err := c.Directions(context.Background(), r)
	if err != nil {
		log.Fatalf("fatal error: %s", err)
	}

	return route[0].OverviewPolyline.Decode()
}

func getDestination(start string, addr []string) string{
	s := rand.NewSource(time.Now().UnixNano())
	r := rand.New(s) // initialize local pseudorandom generator 
	a := r.Intn(len(addr))
	
	if addr[a] == start{
		return getDestination(start, addr)
	} else {
		return addr[a]
	}
}

func postCoordinate (driver int, p maps.LatLng) error {
	url := fmt.Sprintf("http://%s:%s/user/%d/coordinates",SERVER_HOST,SERVER_PORT,driver)
	jsonStr := []byte(fmt.Sprintf(`{"latitude":%f,"longitude":%f}`,p.Lat,p.Lng))
	req, err := http.NewRequest("POST", url, bytes.NewBuffer(jsonStr))
	req.Header.Set("Content-Type", "application/json")
	resp, err := client.Do(req)
	if err != nil{
		return err
	}

	defer resp.Body.Close()
	return nil
}

func routeDriver(driver int, start string, addresses []string){
	//for each driver get a route
	destination := getDestination(start,addresses)
	points := getDirections(start,destination)
	fmt.Println("[START ROUTE] -> DRIVER[",driver,"][",start, destination,"]")

	for _,p := range points {
		err := postCoordinate(driver,p)
		if(err != nil){
			fmt.Println("[ERROR]",err)
		}
		time.Sleep(time.Second)
	}
	//route finihed lets get another one
	routeDriver(driver,destination,addresses)
}

func routes(){
	addresses := []string{
		"Kottbusser Str. 6, 10999 Berlin",
		"Maybachufer 8, 12047 Berlin",
		"Oppelner Str. 22, 10997 Berlin",
		"Reichenberger Str. 115, 10999 Berlin",
		"Skalitzer Str. 42, 10997 Berlin",
	}
	//get of drivers
	drivers,_ := strconv.Atoi(os.Args[2])

	//spwan a route creator for each driver
	for i:=0; i<drivers; i++{
		wg.Add(1)
		go routeDriver(i,getDestination("",addresses), addresses)
	}	
	//dont exit
	wg.Wait()
}
//get ENV
func getEnv(key, fallback string) string {
    if value, ok := os.LookupEnv(key); ok {
        return value
    }
    return fallback
}
var SERVER_HOST = getEnv("HOST","127.0.0.1")
var SERVER_PORT = getEnv("PORT","3000")

func main(){
	
	switch opt :=os.Args[1]; opt {
		case "any":
			randomPoints()
		case "demo":
			routes()
		default:
			fmt.Println("use it as for example: go run ab.go [any,demo] 10")
	}
}